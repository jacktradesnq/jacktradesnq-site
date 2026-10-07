import fs from 'fs';
import path from 'path';

const contentDir = path.join(process.cwd(), 'content', 'studies');
const dataDir = path.join(process.cwd(), 'public', 'data');

import { eventFull } from '@/lib/terminology';
import { eventKeyOf } from './event-key';

// ─── Hub v3 StudyStats API ─────────────────────────────────────────────────

export type AssetType = 'NQ' | 'GC' | 'ES' | 'SI' | 'YM' | 'mixed';
export type FamilyType = 'News' | 'IB' | 'EMA' | 'Time' | 'Misc';
export type WindowType = 'Asia' | 'London' | 'NY 8:30' | 'NY 9:30';

export interface DescriptivePayload {
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  secondaryLabel: string;
  tertiary?: string;
  barSegments?: { label: string; value: number; color: 'sage' | 'gold' | 'terra' | 'mute' }[];
}

export interface StudyStats {
  slug: string;
  href?: string;
  title: string;
  asset: AssetType;
  family: FamilyType;
  window?: WindowType;
  kind: 'strategy' | 'study';
  pf: number;
  n: number;
  edgePts: number;
  wr: number;
  wrByWeekday: number[];
  nByWeekday: number[];
  bestVariant?: string;
  smt?: boolean;
  date: string;
  excerpt?: string;
  descriptive?: DescriptivePayload;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function inferAsset(slug: string): AssetType {
  // 1. Prefix wins (e.g. 'es-ifvg-smt', 'si-ifvg-smt', 'gc-ifvg-*')
  if (slug.startsWith('gc-')) return 'GC';
  if (slug.startsWith('es-')) return 'ES';
  if (slug.startsWith('si-')) return 'SI';
  if (slug.startsWith('ym-')) return 'YM';
  // 2. Suffix strict — anchor is the asset just before -vs-<smt-pair> or at end
  const vsMatch = slug.match(/-(nq|gc|es|si|ym)-vs-(nq|gc|es|si|ym)$/);
  if (vsMatch) {
    const anchor = vsMatch[1].toUpperCase();
    return (anchor === 'NQ' ? 'NQ' : anchor) as AssetType;
  }
  const suffixMatch = slug.match(/-(gc|es|si|ym)$/);
  if (suffixMatch) {
    return suffixMatch[1].toUpperCase() as AssetType;
  }
  return 'NQ';
}

function inferFamily(slug: string, group?: string): FamilyType {
  if (group === '8:30 News Model') return 'News';
  if (group === 'News Behaviour') return 'News';
  if (group === 'Asia / London') return 'Time';
  const newsEvents = [
    'cpi', 'nfp', 'ppi', 'pce', 'gdp', 'joblessclaims', 'jobless-claims',
    'empirestate', 'employmentcostindex', 'retailsales', 'retail-sales',
    'gc-ifvg', 'durable-goods', 'durable_goods', 'fomc', 'ism-mfg',
    'ism-services', 'ism_mfg', 'ism_services', 'jolts', 'philly-fed',
    'philly_fed', 'cb-confidence', 'cb_confidence', 'si-ifvg', 'es-ifvg',
    'nq-ifvg',
  ];
  for (const ev of newsEvents) {
    if (slug.startsWith(ev) || slug.includes(ev)) return 'News';
  }
  if (slug.includes('killzone') || slug.includes('manip')) return 'Time';
  if (slug.includes('nwog') || slug.includes('asia-open')) return 'Time';
  if (slug.includes('ema')) return 'EMA';
  if (slug.includes('ib50') || slug.includes('globex-ib')) return 'IB';
  if (slug.includes('straddle')) return 'News';
  return 'Misc';
}

function inferWindow(slug: string, family: FamilyType, group?: string): WindowType | undefined {
  if (group === '8:30 News Model') return 'NY 8:30';
  if (family === 'News') return 'NY 8:30';
  if (slug.includes('asia') || slug.includes('nwog')) return 'Asia';
  if (slug.includes('london')) return 'London';
  if (slug.includes('930') || slug.includes('9-30')) return 'NY 9:30';
  return undefined;
}

// Compute weekday WR from a trades array
function computeWeekdayWR(trades: Array<{ ts: string; outcome: string }>): {
  wrByWeekday: number[];
  nByWeekday: number[];
} {
  const wins = [0, 0, 0, 0, 0];
  const ns = [0, 0, 0, 0, 0];
  for (const t of trades) {
    const dt = new Date(t.ts);
    const wd = dt.getUTCDay(); // 0=Sun
    const idx = wd - 1; // Mon=0..Fri=4
    if (idx < 0 || idx > 4) continue;
    ns[idx]++;
    if (t.outcome === 'win') wins[idx]++;
  }
  const wrByWeekday = ns.map((n, i) => (n > 0 ? Math.round((wins[i] / n) * 100) : 0));
  return { wrByWeekday, nByWeekday: ns };
}

// ── IFVG-SMT shape ────────────────────────────────────────────────────────────

interface IfvgRow {
  year: string;
  variant: string;
  smt: boolean;
  side: string;
  n: number;
  w: number;
  l: number;
  be: number;
  wr: number;
  pf: number;
  net_pts: number;
  avg_win: number;
  avg_loss: number;
}

interface IfvgTrade {
  ts: string;
  year: number;
  variant: string;
  smt: boolean;
  side: string;
  pnl_pts: number;
  outcome: string;
}

interface HubIfvgJson {
  meta?: Record<string, unknown>;
  rows: IfvgRow[];
  trades: IfvgTrade[];
}

function processIfvgSmt(data: HubIfvgJson): Pick<StudyStats, 'pf' | 'n' | 'edgePts' | 'wr' | 'wrByWeekday' | 'nByWeekday' | 'bestVariant' | 'smt'> {
  const { rows, trades } = data;

  // Group rows by (variant, smt), compute aggregate N for BOTH side
  type GroupKey = string;
  const groupN = new Map<GroupKey, number>();
  for (const r of rows) {
    if (r.side !== 'BOTH') continue;
    const key = `${r.variant}|${r.smt}`;
    groupN.set(key, (groupN.get(key) ?? 0) + r.n);
  }

  // For each group with N>=10, compute PF from trades
  let bestPf = 0;
  let bestKey: GroupKey | null = null;

  for (const [key, totalN] of groupN.entries()) {
    if (totalN < 10) continue;
    const [variant, smtStr] = key.split('|');
    const smtBool = smtStr === 'true';
    const groupTrades = trades.filter(
      (t) => t.variant === variant && t.smt === smtBool,
    );
    const winSum = groupTrades
      .filter((t) => t.outcome === 'win')
      .reduce((s, t) => s + t.pnl_pts, 0);
    const lossSum = groupTrades
      .filter((t) => t.outcome === 'loss')
      .reduce((s, t) => s + Math.abs(t.pnl_pts), 0);
    if (lossSum === 0) continue;
    const pf = winSum / lossSum;
    if (pf > bestPf) {
      bestPf = pf;
      bestKey = key;
    }
  }

  if (!bestKey) {
    return {
      pf: 0, n: 0, edgePts: 0, wr: 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
  }

  const [variant, smtStr] = bestKey.split('|');
  const smtBool = smtStr === 'true';
  const bestTrades = trades.filter(
    (t) => t.variant === variant && t.smt === smtBool,
  );
  const n = bestTrades.length;
  const wins = bestTrades.filter((t) => t.outcome === 'win');
  const wr = n > 0 ? Math.round((wins.length / n) * 100) : 0;
  const edgePts = Math.round(bestTrades.reduce((s, t) => s + t.pnl_pts, 0));
  const { wrByWeekday, nByWeekday } = computeWeekdayWR(bestTrades);

  return {
    pf: Math.round(bestPf * 100) / 100,
    n,
    edgePts,
    wr,
    wrByWeekday,
    nByWeekday,
    bestVariant: variant,
    smt: smtBool,
  };
}

// ── Straddle shape ────────────────────────────────────────────────────────────

interface StraddleRow {
  stop_pts: number;
  tp_pts: number;
  events_total: number;
  fill_rate: number;
  tp_hit_rate: number;
  avg_pnl_per_event: number;
}

interface StraddleJson {
  ranked?: StraddleRow[];
  best?: StraddleRow;
}

function processStraddle(data: StraddleJson, n_events_hint?: number): Pick<StudyStats, 'pf' | 'n' | 'edgePts' | 'wr' | 'wrByWeekday' | 'nByWeekday' | 'bestVariant'> {
  const rows = data.ranked ?? [];
  const eligible = rows.filter((r) => r.events_total >= 10);
  if (!eligible.length) {
    return {
      pf: 0, n: 0, edgePts: 0, wr: 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
  }
  const best = eligible[0];
  // PF approximation: (tp_rate * tp_pts) / ((fill_rate - tp_rate) * stop_pts)
  const fillRate = best.fill_rate / 100;
  const tpRate = best.tp_hit_rate / 100;
  const stopRate = fillRate - tpRate;
  let pf = 0;
  if (stopRate > 0 && tpRate > 0) {
    pf = (tpRate * best.tp_pts) / (stopRate * best.stop_pts);
  }
  const edgePts = Math.round(best.avg_pnl_per_event * (best.events_total));
  const n = best.events_total;
  const wr = Math.round(tpRate * 100);

  return {
    pf: Math.round(pf * 100) / 100,
    n,
    edgePts,
    wr,
    wrByWeekday: [0, 0, 0, 0, 0],
    nByWeekday: [0, 0, 0, 0, 0],
    bestVariant: `stop ${best.stop_pts}pt / tp ${best.tp_pts}pt`,
  };
}

// ── NWOG shape ────────────────────────────────────────────────────────────────

interface NwogJson {
  symbol?: string;
  totalEvents?: number;
  dateRange?: { from: string; to: string };
  summary?: {
    direct?: { count: number; pct: number };
    later?: { count: number; pct: number };
    held?: { count: number; pct: number };
    bull?: { count: number; direct: number; later: number; held: number };
    bear?: { count: number; direct: number; later: number; held: number };
  };
}

function processNwog(data: NwogJson): Pick<StudyStats, 'pf' | 'n' | 'edgePts' | 'wr' | 'wrByWeekday' | 'nByWeekday'> {
  const n = data.totalEvents ?? 0;
  const directPct = data.summary?.direct?.pct ?? 0;
  return {
    pf: directPct > 80 ? parseFloat((directPct / 20).toFixed(2)) : 0,
    n,
    edgePts: 0,
    wr: Math.round(directPct),
    wrByWeekday: [0, 0, 0, 0, 0],
    nByWeekday: [0, 0, 0, 0, 0],
  };
}

// ── Killzone shape ────────────────────────────────────────────────────────────

interface KillzoneRow {
  killzone: string;
  n: number;
  avgRange: number;
  medRange: number;
  avgMove: number;
}

interface KillzoneJson {
  overall?: KillzoneRow[];
}

function processKillzone(data: KillzoneJson): Pick<StudyStats, 'pf' | 'n' | 'edgePts' | 'wr' | 'wrByWeekday' | 'nByWeekday'> {
  const rows = data.overall ?? [];
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (!total) {
    return {
      pf: 0, n: 0, edgePts: 0, wr: 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
  }
  const avgRange = rows.reduce((s, r) => s + r.avgRange * r.n, 0) / total;
  return {
    pf: 0,
    n: total,
    edgePts: Math.round(avgRange),
    wr: 0,
    wrByWeekday: [0, 0, 0, 0, 0],
    nByWeekday: [0, 0, 0, 0, 0],
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function loadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

// Slug-to-data-file overrides (when filename differs from slug)
const SLUG_DATA_MAP: Record<string, string> = {
  'asia-open': 'nwog-gc',
  'killzone-past-vs-now': 'killzone-gc',
  'cpi-day-stats': 'cpi-straddle',
  'nfp': 'nfp-straddle',
};

// Map day-stats slug → exact event_bars JSON filename (without .json)
// Handles all 7 events × 3 assets (NQ = base, ES, GC)
const DAY_STATS_EVENT_BARS_MAP: Record<string, string> = {
  'cb-confidence-day-stats':    'cb_confidence_event_bars',
  'cb-confidence-day-stats-es': 'cb_confidence_event_bars_es',
  'cb-confidence-day-stats-gc': 'cb_confidence_event_bars_gc',
  'cpi-day-stats-es':           'cpi_event_bars_es',
  'cpi-day-stats-gc':           'cpi_event_bars_gc',
  'durable-goods-day-stats':    'durable_goods_event_bars',
  'durable-goods-day-stats-es': 'durable_goods_event_bars_es',
  'durable-goods-day-stats-gc': 'durable_goods_event_bars_gc',
  'fomc-day-stats-es':          'fomc_event_bars_es',
  'fomc-day-stats-gc':          'fomc_event_bars_gc',
  'ism-mfg-day-stats':          'ism_mfg_event_bars',
  'ism-mfg-day-stats-es':       'ism_mfg_event_bars_es',
  'ism-mfg-day-stats-gc':       'ism_mfg_event_bars_gc',
  'ism-services-day-stats':     'ism_services_event_bars',
  'ism-services-day-stats-es':  'ism_services_event_bars_es',
  'ism-services-day-stats-gc':  'ism_services_event_bars_gc',
  'philly-fed-day-stats':       'philly_fed_event_bars',
  'philly-fed-day-stats-es':    'philly_fed_event_bars_es',
  'philly-fed-day-stats-gc':    'philly_fed_event_bars_gc',
  // NQ base for cpi/nfp/fomc handled via SLUG_DATA_MAP (straddle) + separate event_bars
  'nfp-day-stats':              'nfp_event_bars',
  'nfp-day-stats-es':           'nfp_event_bars_es',
  'nfp-day-stats-gc':           'nfp_event_bars_gc',
};

// Resolve event_bars JSON path for a day-stats slug, or null if not a day-stats slug
function getDayStatsJsonPath(slug: string): string | null {
  const filename = DAY_STATS_EVENT_BARS_MAP[slug];
  if (!filename) return null;
  return path.join(dataDir, `${filename}.json`);
}

function processOneSlug(slug: string): StudyStats | null {
  const metaPath = path.join(contentDir, slug, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as {
    title: string;
    titleNq?: string;
    category: string;
    date: string;
    group?: string;
    excerpt?: string;
  };

  const title = meta.titleNq ?? meta.title;
  const group = meta.group;
  const date = meta.date;
  const excerpt = meta.excerpt ?? '';
  const family = inferFamily(slug, group);
  const asset = inferAsset(slug);
  const window = inferWindow(slug, family, group);

  // Day-stats slugs: resolve directly to event_bars JSON (bypasses SLUG_DATA_MAP logic)
  const dayStatsPath = getDayStatsJsonPath(slug);
  if (dayStatsPath !== null) {
    const ebData = loadJson<Array<{ date: string; t0_iso: string; entry_price: number; bars: unknown[] }>>(dayStatsPath);
    const n = Array.isArray(ebData) ? ebData.length : 0;
    const kind: 'strategy' | 'study' = 'study';
    const stats = {
      pf: 0, n, edgePts: 0, wr: 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
    const descriptive: DescriptivePayload | undefined = n > 0
      ? {
          primaryValue: `${n}`,
          primaryLabel: 'releases charted',
          secondaryValue: `${asset} · 10y`,
          secondaryLabel: 'per-release bar chart',
          tertiary: excerpt || undefined,
        }
      : excerpt
        ? { primaryValue: '—', primaryLabel: 'no data', secondaryValue: date, secondaryLabel: asset, tertiary: excerpt }
        : undefined;
    return { slug, title, asset, family, window, kind, date, excerpt, descriptive, ...stats };
  }

  // Resolve data file (slug override or exact match).
  // GC convention: slug ends with -gc → filename uses _gc.json (underscore).
  const dataSlug = SLUG_DATA_MAP[slug] ?? slug;
  const dataFilename = dataSlug.endsWith('-gc')
    ? `${dataSlug.slice(0, -3)}_gc.json`
    : `${dataSlug}.json`;
  const jsonPath = path.join(dataDir, dataFilename);
  const jsonData = loadJson<Record<string, unknown>>(jsonPath);

  let kind: 'strategy' | 'study' = 'strategy';
  let descriptive: DescriptivePayload | undefined;
  let stats: Pick<StudyStats, 'pf' | 'n' | 'edgePts' | 'wr' | 'wrByWeekday' | 'nByWeekday' | 'bestVariant' | 'smt'>;

  const asUnknown = jsonData as unknown;
  if (jsonData && Array.isArray((asUnknown as HubIfvgJson).rows) && Array.isArray((asUnknown as HubIfvgJson).trades)) {
    kind = 'strategy';
    stats = processIfvgSmt(asUnknown as HubIfvgJson);
  } else if (jsonData && Array.isArray((asUnknown as StraddleJson).ranked)) {
    // Straddle: has real backtest data but stats may be marginal — render as study
    kind = 'study';
    const n_events = (asUnknown as StraddleJson).ranked?.[0]?.events_total ?? 0;
    const straddleStats = processStraddle(asUnknown as StraddleJson);
    stats = straddleStats;
    descriptive = {
      primaryValue: `${n_events}`,
      primaryLabel: 'releases backtested',
      secondaryValue: straddleStats.bestVariant ?? '—',
      secondaryLabel: 'best combo',
      tertiary: excerpt || 'Straddle backtest — explore offset/TP combos',
    };
  } else if (jsonData && typeof (asUnknown as NwogJson).totalEvents === 'number') {
    kind = 'study';
    const nwogData = asUnknown as NwogJson;
    const directPct = nwogData.summary?.direct?.pct ?? 0;
    const laterPct = nwogData.summary?.later?.pct ?? 0;
    const heldPct = nwogData.summary?.held?.pct ?? 0;
    const bullDirect = nwogData.summary?.bull?.direct ?? 0;
    const bearDirect = nwogData.summary?.bear?.direct ?? 0;
    const totalN = nwogData.totalEvents ?? 0;
    stats = processNwog(nwogData);
    const dateRangeStr = nwogData.dateRange
      ? `${new Date(nwogData.dateRange.from).getFullYear()}–${new Date(nwogData.dateRange.to).getFullYear()}`
      : '10y';
    descriptive = {
      primaryValue: `${directPct.toFixed(1)}%`,
      primaryLabel: 'fill in 30 min',
      secondaryValue: `${totalN} events`,
      secondaryLabel: `${dateRangeStr} · ${nwogData.symbol ?? asset}`,
      tertiary: `Bull ${bullDirect.toFixed(1)}% · Bear ${bearDirect.toFixed(1)}%`,
      barSegments: [
        { label: 'Direct', value: Math.round(directPct), color: 'sage' },
        { label: 'Later', value: Math.round(laterPct), color: 'gold' },
        { label: 'Held', value: Math.round(heldPct), color: 'mute' },
      ],
    };
  } else if (jsonData && Array.isArray((asUnknown as KillzoneJson).overall)) {
    kind = 'study';
    const kzData = asUnknown as KillzoneJson;
    const rows = kzData.overall ?? [];
    const totalN = rows.reduce((s, r) => s + r.n, 0);
    // Find session with highest avgRange
    const best = rows.reduce((a, b) => (a.avgRange > b.avgRange ? a : b), rows[0]);
    const minR = rows.reduce((a, b) => (a.avgRange < b.avgRange ? a : b), rows[0]);
    stats = processKillzone(kzData);
    descriptive = {
      primaryValue: `${best?.avgRange?.toFixed(1) ?? '—'} pts`,
      primaryLabel: `avg range ${best?.killzone ?? ''}`,
      secondaryValue: `${totalN.toLocaleString()} sessions`,
      secondaryLabel: `10y · ${asset}`,
      tertiary: rows.length >= 2 ? `${minR.killzone} ${minR.avgRange.toFixed(1)} pts → ${best.killzone} ${best.avgRange.toFixed(1)} pts` : undefined,
      barSegments: rows.map((r) => ({
        label: r.killzone,
        value: Math.round(r.avgRange * 10) / 10,
        color: r === best ? 'gold' as const : 'mute' as const,
      })),
    };
  } else if (
    jsonData &&
    Array.isArray((asUnknown as { trades?: unknown[] }).trades) &&
    typeof (asUnknown as { meta?: { default_tp?: number } }).meta?.default_tp === 'number'
  ) {
    // Generic param-grid study ({meta, trades} with y_tp axis) — headline = default TP, trailing 1y
    kind = 'strategy';
    const gj = asUnknown as { meta: { default_tp: number }; trades: Array<{ y_tp: number; pnl_pts: number; ts: string }> };
    const defTp = gj.meta.default_tp;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutStr = cutoff.toISOString();
    const tr = gj.trades.filter((t) => t.y_tp === defTp && t.ts >= cutStr);
    const wins = tr.filter((t) => t.pnl_pts > 0);
    const grossW = wins.reduce((s, t) => s + t.pnl_pts, 0);
    const grossL = Math.abs(tr.filter((t) => t.pnl_pts <= 0).reduce((s, t) => s + t.pnl_pts, 0));
    const n = tr.length;
    stats = {
      pf: grossL ? Math.round((grossW / grossL) * 100) / 100 : 0,
      n,
      edgePts: n ? Math.round((tr.reduce((s, t) => s + t.pnl_pts, 0) / n) * 10) / 10 : 0,
      wr: n ? Math.round((wins.length / n) * 100) : 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
  } else {
    // No hub JSON data — render as study.
    kind = 'study';
    stats = {
      pf: 0, n: 0, edgePts: 0, wr: 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
    // Report-card studies (report.json, e.g. opex/news-830-candle/amd-reversal)
    // carry no hub JSON but DO have a rich headline stat — surface it so the
    // hub list shows their number instead of "no data".
    const reportPath = path.join(contentDir, slug, 'report.json');
    if (fs.existsSync(reportPath)) {
      try {
        const rep = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
          eyebrow?: string;
          hero?: { stat?: string };
          chart?: { label?: string };
        };
        const stat = rep.hero?.stat?.trim();
        if (stat) {
          const parts = (rep.eyebrow ?? '').split('·').map((p) => p.trim()).filter(Boolean);
          descriptive = {
            primaryValue: stat,
            primaryLabel: parts[0] || rep.chart?.label || 'key finding',
            secondaryValue: parts.length > 1 ? parts.slice(1).join(' · ') : `${asset} · 10y`,
            secondaryLabel: 'study',
            tertiary: excerpt || rep.chart?.label || undefined,
          };
        }
      } catch {
        /* malformed report.json — fall through to the no-data teaser below */
      }
    }
    if (!descriptive && excerpt) {
      descriptive = {
        primaryValue: '—',
        primaryLabel: 'no data',
        secondaryValue: date,
        secondaryLabel: asset,
        tertiary: excerpt,
      };
    }
  }

  // Demote losing strategies (profit factor < 1) out of the tradeable
  // "Strategies" list: a setup that loses money isn't an edge. Keep it fully
  // visible as a data finding (kind='study') tagged "no edge" — never deleted,
  // so the honesty/rigour is preserved while the Strategies list shows only
  // setups that actually made money.
  if (kind === 'strategy' && stats.pf > 0 && stats.pf < 1) {
    kind = 'study';
    descriptive = {
      primaryValue: `${stats.pf.toFixed(2)}×`,
      primaryLabel: 'no edge',
      secondaryValue: `${stats.n} trades · ${stats.wr}% win rate`,
      secondaryLabel: asset,
      tertiary: excerpt || undefined,
    };
  }

  return {
    slug,
    title,
    asset,
    family,
    window,
    kind,
    date,
    excerpt,
    descriptive,
    ...stats,
  };
}

const FULLPORT_EVENTS: Array<{ slug: string; dataKey: string; eventName: string }> = [
  { slug: 'cpi-day-stats',   dataKey: 'cpi',            eventName: 'CPI' },
  { slug: 'nfp',             dataKey: 'nfp',            eventName: 'NFP' },
  { slug: 'ppi',             dataKey: 'ppi',            eventName: 'PPI' },
  { slug: 'pce',             dataKey: 'pce',            eventName: 'PCE' },
  { slug: 'retail-sales',    dataKey: 'retail-sales',   eventName: 'Retail Sales' },
  { slug: 'jobless-claims',  dataKey: 'jobless-claims', eventName: 'Jobless Claims' },
  { slug: 'durable-goods',   dataKey: 'durable-goods',  eventName: 'Durable Goods' },
];

function getVirtualFullportCards(existing: StudyStats[]): StudyStats[] {
  const existingSlugs = new Set(existing.map(s => s.slug));
  const out: StudyStats[] = [];
  for (const ev of FULLPORT_EVENTS) {
    for (const asset of ['gc', 'si', 'es'] as const) {
      const staticKey = `${ev.slug}-${asset}`;
      if (existingSlugs.has(staticKey)) continue;

      const jsonPath = path.join(dataDir, `${ev.dataKey}-straddle-${asset}.json`);
      if (!fs.existsSync(jsonPath)) continue;

      const json = loadJson<StraddleJson>(jsonPath);
      if (!json || !Array.isArray(json.ranked) || json.ranked.length === 0) continue;
      const n = json.ranked[0].events_total ?? 0;
      const straddleStats = processStraddle(json);
      const ASSET = asset.toUpperCase() as AssetType;

      out.push({
        slug: `${ev.slug}__${asset}`,
        href: `/studies/${ev.slug}/?asset=${asset}`,
        title: `${ev.eventName} fullport (${ASSET})`,
        asset: ASSET,
        family: 'News',
        window: 'NY 8:30',
        kind: 'study',
        pf: straddleStats.pf,
        n,
        edgePts: straddleStats.edgePts,
        wr: straddleStats.wr,
        wrByWeekday: straddleStats.wrByWeekday,
        nByWeekday: straddleStats.nByWeekday,
        bestVariant: straddleStats.bestVariant,
        smt: false,
        date: '2026-05-23',
        excerpt: `${ev.eventName} 8:30 ET straddle — ${ASSET} ${n} events, best combo ${straddleStats.bestVariant ?? ''}`,
      });
    }
  }
  return out;
}

export function getDistinctEventCount(studies: StudyStats[]): number {
  const set = new Set<string>();
  for (const st of studies) {
    const k = eventKeyOf(st.slug);
    if (k) set.add(k);
  }
  return set.size;
}

export function getAllStudyStats(): StudyStats[] {
  if (!fs.existsSync(contentDir)) return [];

  const slugs = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const base = slugs
    .map((slug) => {
      try {
        return processOneSlug(slug);
      } catch {
        return null;
      }
    })
    .filter((s): s is StudyStats => s !== null);

  return [...base, ...getVirtualFullportCards(base)];
}

export function getStudyCountsByFamily(): { total: number; news: number; ib: number; ema: number; time: number; misc: number } {
  const all = getAllStudyStats();
  return {
    total: all.length,
    news: all.filter((s) => s.family === 'News').length,
    ib: all.filter((s) => s.family === 'IB').length,
    ema: all.filter((s) => s.family === 'EMA').length,
    time: all.filter((s) => s.family === 'Time').length,
    misc: all.filter((s) => s.family === 'Misc').length,
  };
}

export interface NavEvent { key: string; label: string; count: number; bestPf: number; }
export interface NavFamily { family: FamilyType; label: string; cat: string; count: number; events: NavEvent[]; }

// Keys for cross-asset rollup cards that should be surfaced in their own group
const CROSS_ASSET_KEYS = new Set(['es-ifvg-smt', 'si-ifvg-smt']);

const NAV_FAMILY_ORDER: { family: FamilyType; label: string; cat: string }[] = [
  { family: 'News', label: 'News',            cat: 'news' },
  { family: 'Time', label: 'Sessions',        cat: 'time' },
  { family: 'IB',   label: 'Initial Balance', cat: 'ib'   },
  { family: 'EMA',  label: 'EMA',             cat: 'ema'  },
  { family: 'Misc', label: 'Other',           cat: 'misc' },
];

export function getStudyNavTree(): NavFamily[] {
  const all = getAllStudyStats();
  const out: NavFamily[] = [];
  const crossAssetEvents: NavEvent[] = [];

  for (const fam of NAV_FAMILY_ORDER) {
    const items = all.filter((s) => s.family === fam.family);
    if (items.length === 0) continue;
    const evMap = new Map<string, StudyStats[]>();
    for (const s of items) {
      const k = eventKeyOf(s.slug) ?? s.slug;
      const arr = evMap.get(k) ?? [];
      arr.push(s);
      evMap.set(k, arr);
    }
    const allEvents: NavEvent[] = [...evMap.entries()]
      .map(([key, arr]) => ({ key, label: eventFull(key), count: arr.length, bestPf: Math.max(...arr.map((x) => x.pf)) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Separate cross-asset rollup events from this family
    const familyEvents = allEvents.filter((ev) => !CROSS_ASSET_KEYS.has(ev.key));
    const extracted = allEvents.filter((ev) => CROSS_ASSET_KEYS.has(ev.key));
    crossAssetEvents.push(...extracted);

    if (familyEvents.length === 0) continue;
    const familyCount = all.filter((s) => s.family === fam.family && !CROSS_ASSET_KEYS.has(eventKeyOf(s.slug) ?? s.slug)).length;
    out.push({ family: fam.family, label: fam.label, cat: fam.cat, count: familyCount, events: familyEvents });
  }

  // Append Cross-asset group after Initial Balance (already last in IB's position)
  if (crossAssetEvents.length > 0) {
    const crossCount = crossAssetEvents.reduce((sum, ev) => sum + ev.count, 0);
    const ibIdx = out.findIndex((f) => f.family === 'IB');
    const insertAt = ibIdx >= 0 ? ibIdx + 1 : out.length;
    out.splice(insertAt, 0, {
      family: 'Misc' as FamilyType,
      label: 'Cross-asset',
      cat: 'misc',
      count: crossCount,
      events: crossAssetEvents.sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  return out;
}
