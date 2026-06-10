import fs from 'fs';
import path from 'path';

const contentDir = path.join(process.cwd(), 'content', 'studies');
const dataDir = path.join(process.cwd(), 'public', 'data');

export { MIN_DISPLAY_PF } from './study-display-config';
import { MIN_DISPLAY_PF } from './study-display-config';
import { eventFull } from '@/lib/terminology';

export type ProfitableCombo = {
  variant: 'tp1_be' | 'be_50' | 'no_be';
  smt: boolean;
  pf: number;
};

type Trade = {
  ts: string;
  year: string | number;
  variant: string;
  smt: boolean;
  side: string;
  pnl_pts: number;
  outcome: string;
};

type Row = {
  year: string | number;
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
};

type IfvgJson = {
  meta?: Record<string, unknown>;
  rows?: Row[];
  trades?: Trade[];
};

function loadIfvgJson(slug: string): IfvgJson | null {
  const filename = slug.endsWith('-gc') ? slug.slice(0, -3) + '_gc.json' : `${slug}.json`;
  const p = path.join(dataDir, filename);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as IfvgJson;
  } catch {
    return null;
  }
}

/**
 * Return all IFVG combos (variant × smt) whose lifetime PF >= MIN_DISPLAY_PF.
 * Reads rows[year="ALL", side="BOTH"] from the study JSON.
 * Returns null when the JSON cannot be read.
 */
export function getProfitableIfvgCombos(slug: string): ProfitableCombo[] | null {
  const json = loadIfvgJson(slug);
  if (!json || !json.rows) return null;
  const out: ProfitableCombo[] = [];
  for (const row of json.rows) {
    if (row.year !== 'ALL') continue;
    if (row.side !== 'BOTH') continue;
    if (row.pf >= MIN_DISPLAY_PF) {
      out.push({
        variant: row.variant as 'tp1_be' | 'be_50' | 'no_be',
        smt: row.smt,
        pf: row.pf,
      });
    }
  }
  return out;
}

export type StrategyStats = {
  slug: string;
  event: string;
  asset: string;
  pf: number;
  n: number;
  net: number;
  wr: number;
  bias: string;
  dateFrom: string;
  dateTo: string;
  releaseTime?: string;
};

export type WeekdayStats = {
  n: number;
  w: number;
  net: number;
  wr: number;
};

export type WeekdayBreakdown = {
  mon: WeekdayStats;
  tue: WeekdayStats;
  wed: WeekdayStats;
  thu: WeekdayStats;
  fri: WeekdayStats;
};

// IFVG SMT slugs that have a trades[] array we can derive stats from
const IFVG_SLUGS: Array<{ slug: string; event: string; asset: string; releaseTime?: string }> = [
  { slug: 'cpi-ifvg-smt',                event: 'CPI',                  asset: 'NQ' },
  { slug: 'nfp-ifvg-smt',                event: 'NFP',                  asset: 'NQ' },
  { slug: 'ppi-ifvg-smt',                event: 'PPI',                  asset: 'NQ' },
  { slug: 'pce-ifvg-smt',                event: 'PCE',                  asset: 'NQ' },
  { slug: 'joblessclaims-ifvg-smt',      event: 'Jobless Claims',       asset: 'NQ' },
  { slug: 'retailsales-ifvg-smt',        event: 'Retail Sales',         asset: 'NQ' },
  { slug: 'empirestate-ifvg-smt',        event: 'Empire State',         asset: 'NQ' },
  { slug: 'employmentcostindex-ifvg-smt',event: 'Employment Cost',      asset: 'NQ' },
  { slug: 'gdp-ifvg-smt',               event: 'GDP',                  asset: 'NQ' },
  { slug: 'fomc-ifvg-smt',              event: 'FOMC',                 asset: 'NQ', releaseTime: '14:00 ET' },
  { slug: 'adp-ifvg-smt',               event: 'ADP',                  asset: 'NQ', releaseTime: '8:15 ET' },
  { slug: 'jolts-ifvg-smt',             event: 'JOLTS',                asset: 'NQ', releaseTime: '10:00 ET' },
  { slug: 'ism-mfg-ifvg-smt',           event: 'ISM Manufacturing PMI', asset: 'NQ', releaseTime: '10:00 ET' },
  { slug: 'ism-services-ifvg-smt',      event: 'ISM Services PMI',      asset: 'NQ', releaseTime: '10:00 ET' },


  { slug: 'durable-goods-ifvg-smt',     event: 'Durable Goods Orders', asset: 'NQ', releaseTime: '8:30 ET' },
  { slug: 'cpi-ifvg-smt-gc',                 event: 'CPI',             asset: 'GC' },
  { slug: 'nfp-ifvg-smt-gc',                 event: 'NFP',             asset: 'GC' },
  { slug: 'ppi-ifvg-smt-gc',                 event: 'PPI',             asset: 'GC' },

  { slug: 'gdp-ifvg-smt-gc',                 event: 'GDP',             asset: 'GC' },
  { slug: 'joblessclaims-ifvg-smt-gc',       event: 'Jobless Claims',  asset: 'GC' },
  { slug: 'retailsales-ifvg-smt-gc',         event: 'Retail Sales',    asset: 'GC' },
  { slug: 'empirestate-ifvg-smt-gc',         event: 'Empire State',    asset: 'GC' },
  { slug: 'employmentcostindex-ifvg-smt-gc', event: 'Employment Cost', asset: 'GC' },
  { slug: 'fomc-ifvg-smt-gc',                event: 'FOMC',            asset: 'GC', releaseTime: '14:00 ET' },
  { slug: 'adp-ifvg-smt-gc',                 event: 'ADP',             asset: 'GC', releaseTime: '8:15 ET' },
  { slug: 'jolts-ifvg-smt-gc',               event: 'JOLTS',           asset: 'GC', releaseTime: '10:00 ET' },
  { slug: 'ism-mfg-ifvg-smt-gc',             event: 'ISM Manufacturing PMI', asset: 'GC', releaseTime: '10:00 ET' },
  { slug: 'ism-services-ifvg-smt-gc',        event: 'ISM Services PMI',      asset: 'GC', releaseTime: '10:00 ET' },

  { slug: 'philly-fed-ifvg-smt-gc',          event: 'Philadelphia Fed Manufacturing', asset: 'GC', releaseTime: '8:30 ET' },
  { slug: 'durable-goods-ifvg-smt-gc',       event: 'Durable Goods Orders', asset: 'GC', releaseTime: '8:30 ET' },
  { slug: 'es-ifvg-smt',                event: 'Multi-event',          asset: 'ES' },
  { slug: 'si-ifvg-smt',                event: 'Multi-event',          asset: 'SI' },
  { slug: 'cpi-ifvg-smt-es',                 event: 'CPI',             asset: 'ES' },
  { slug: 'nfp-ifvg-smt-es',                 event: 'NFP',             asset: 'ES' },
  { slug: 'ppi-ifvg-smt-es',                 event: 'PPI',             asset: 'ES' },
  { slug: 'pce-ifvg-smt-es',                 event: 'PCE',             asset: 'ES' },
  { slug: 'gdp-ifvg-smt-es',                 event: 'GDP',             asset: 'ES' },
  { slug: 'joblessclaims-ifvg-smt-es',       event: 'Jobless Claims',  asset: 'ES' },
  { slug: 'retailsales-ifvg-smt-es',         event: 'Retail Sales',    asset: 'ES' },
  { slug: 'empirestate-ifvg-smt-es',         event: 'Empire State',    asset: 'ES' },
  { slug: 'employmentcostindex-ifvg-smt-es', event: 'Employment Cost', asset: 'ES' },
  { slug: 'fomc-ifvg-smt-es',                event: 'FOMC',            asset: 'ES', releaseTime: '14:00 ET' },
  { slug: 'adp-ifvg-smt-es',                 event: 'ADP',             asset: 'ES', releaseTime: '8:15 ET' },
  { slug: 'jolts-ifvg-smt-es',               event: 'JOLTS',           asset: 'ES', releaseTime: '10:00 ET' },
  { slug: 'ism-mfg-ifvg-smt-es',             event: 'ISM Manufacturing PMI', asset: 'ES', releaseTime: '10:00 ET' },
  { slug: 'ism-services-ifvg-smt-es',        event: 'ISM Services PMI',      asset: 'ES', releaseTime: '10:00 ET' },


  { slug: 'durable-goods-ifvg-smt-es',       event: 'Durable Goods Orders', asset: 'ES', releaseTime: '8:30 ET' },
];

// Map event slug prefix → human-readable event name (used by inferIfvgStats)
const EVENT_NAME_FROM_PREFIX: Record<string, string> = {
  'cpi':                   'CPI',
  'nfp':                   'NFP',
  'ppi':                   'PPI',
  'pce':                   'PCE',
  'gdp':                   'GDP',
  'joblessclaims':         'Jobless Claims',
  'retailsales':           'Retail Sales',
  'empirestate':           'Empire State',
  'employmentcostindex':   'Employment Cost',
  'fomc':                  'FOMC',
  'adp':                   'ADP',
  'jolts':                 'JOLTS',
  'ism-mfg':               'ISM Manufacturing PMI',
  'ism-services':          'ISM Services PMI',
  'cb-confidence':         'CB Consumer Confidence',
  'philly-fed':            'Philadelphia Fed Manufacturing',
  'durable-goods':         'Durable Goods Orders',
};

const ASSET_KEYS = ['nq', 'es', 'gc', 'si', 'ym'] as const;
type AssetKey = typeof ASSET_KEYS[number];

/**
 * Infer {event, asset} from slug patterns not in the hardcoded IFVG_SLUGS array.
 * Handles:
 *   - "<asset>-ifvg-smt"               → Multi-event aggregate (si-ifvg-smt, nq-ifvg-smt, es-ifvg-smt)
 *   - "<asset>-ifvg-smt-vs-<y>"         → Multi-event aggregate (es-ifvg-smt-vs-ym, nq-ifvg-smt-vs-ym)
 *   - "<event>-ifvg-smt-<anchor>"        → per-event, anchor asset
 *   - "<event>-ifvg-smt-<anchor>-vs-<y>" → per-event, anchor asset
 *   - "<event>-ifvg-smt-<x>-vs-<anchor>" → per-event, x is anchor (x != ym special)
 */
function inferIfvgStats(slug: string): { slug: string; event: string; asset: string; releaseTime?: string } | null {
  // Pattern: <asset>-ifvg-smt or <asset>-ifvg-smt-vs-<y>  (aggregate slugs)
  const aggMatch = slug.match(/^(nq|es|gc|si|ym)-ifvg-smt(?:-vs-(?:nq|es|gc|si|ym))?$/);
  if (aggMatch) {
    return { slug, event: 'Multi-event', asset: aggMatch[1].toUpperCase() };
  }

  // Pattern: <event>-ifvg-smt-<anchor>(-vs-<smt>)?
  // The anchor is group 2; the optional smt pair is group 3.
  // e.g. cpi-ifvg-smt-ym → event=CPI anchor=YM
  //      cpi-ifvg-smt-ym-vs-es → event=CPI anchor=YM smt=ES
  //      cpi-ifvg-smt-nq-vs-ym → event=CPI anchor=NQ smt=YM
  const evMatch = slug.match(
    /^(.+?)-ifvg-smt-(nq|es|gc|si|ym)(?:-vs-(nq|es|gc|si|ym))?$/
  );
  if (evMatch) {
    const eventKey = evMatch[1];
    const anchor = evMatch[2] as AssetKey;
    const eventName = EVENT_NAME_FROM_PREFIX[eventKey];
    if (!eventName) return null;
    return { slug, event: eventName, asset: anchor.toUpperCase() };
  }

  return null;
}

function resolveIfvgEntry(slug: string): { slug: string; event: string; asset: string; releaseTime?: string } | null {
  return IFVG_SLUGS.find((e) => e.slug === slug) ?? inferIfvgStats(slug);
}

function computeIfvgStats(
  json: IfvgJson,
  slugEntry: { slug: string; event: string; asset: string; releaseTime?: string },
  variant: 'tp1_be' | 'be_50' | 'no_be' = 'tp1_be',
  smtOn = true,
): StrategyStats {
  const trades = (json.trades ?? []).filter(
    (t) => t.variant === variant && (smtOn ? t.smt === true : true)
  );
  const n = trades.length;
  const wins = trades.filter((t) => t.pnl_pts > 0).length;
  const net = trades.reduce((s, t) => s + t.pnl_pts, 0);
  const wr = n > 0 ? wins / n : 0;
  const winPnl = trades.filter((t) => t.pnl_pts > 0).reduce((s, t) => s + t.pnl_pts, 0);
  const lossPnl = Math.abs(trades.filter((t) => t.pnl_pts < 0).reduce((s, t) => s + t.pnl_pts, 0));
  const pf = lossPnl > 0 ? winPnl / lossPnl : winPnl > 0 ? 99 : 0;
  const meta = json.meta as Record<string, string> | undefined;
  const dateFrom = meta?.date_from ?? '';
  const dateTo = meta?.date_to ?? '';

  // Simple bias: if more long trades win than short, bias is Long
  const longs = trades.filter((t) => t.side.toLowerCase() === 'long');
  const shorts = trades.filter((t) => t.side.toLowerCase() === 'short');
  const longWr = longs.length > 0 ? longs.filter((t) => t.pnl_pts > 0).length / longs.length : 0;
  const shortWr = shorts.length > 0 ? shorts.filter((t) => t.pnl_pts > 0).length / shorts.length : 0;
  const bias = longWr > shortWr + 0.05 ? 'Long' : shortWr > longWr + 0.05 ? 'Short' : 'Both';

  return {
    slug: slugEntry.slug,
    event: slugEntry.event,
    asset: slugEntry.asset,
    pf: Math.round(pf * 100) / 100,
    n,
    net: Math.round(net * 10) / 10,
    wr: Math.round(wr * 100),
    bias,
    dateFrom,
    dateTo,
    releaseTime: slugEntry.releaseTime,
  };
}

let _stratCache: StrategyStats[] | null = null;

function getAllStrategyStats(): StrategyStats[] {
  if (_stratCache) return _stratCache;
  const results: StrategyStats[] = [];
  for (const entry of IFVG_SLUGS) {
    const json = loadIfvgJson(entry.slug);
    if (!json) continue;
    const stats = computeIfvgStats(json, entry);
    if (stats.n > 0) results.push(stats);
  }
  _stratCache = results;
  return results;
}

export function getStrategyStats(slug: string): StrategyStats | null {
  // Check hardcoded cache first
  const cached = getAllStrategyStats().find((s) => s.slug === slug);
  if (cached) return cached;
  // Fallback: infer from slug pattern (YM variants, SI aggregate, etc.)
  const entry = inferIfvgStats(slug);
  if (!entry) return null;
  const json = loadIfvgJson(slug);
  if (!json) return null;
  const stats = computeIfvgStats(json, entry);
  return stats.n > 0 ? stats : null;
}

export function getStrategyStatsByVariant(slug: string): { tp1_be: StrategyStats; be_50: StrategyStats; no_be: StrategyStats } | null {
  const entry = resolveIfvgEntry(slug);
  if (!entry) return null;
  const json = loadIfvgJson(slug);
  if (!json) return null;
  return {
    tp1_be: computeIfvgStats(json, entry, 'tp1_be'),
    be_50:  computeIfvgStats(json, entry, 'be_50'),
    no_be:  computeIfvgStats(json, entry, 'no_be'),
  };
}

export type VariantStatsTriplet = { tp1_be: StrategyStats; be_50: StrategyStats; no_be: StrategyStats };

export function getStrategyStatsByVariantAndSmt(slug: string): { smtOn: VariantStatsTriplet; smtOff: VariantStatsTriplet } | null {
  const entry = resolveIfvgEntry(slug);
  if (!entry) return null;
  const json = loadIfvgJson(slug);
  if (!json) return null;
  return {
    smtOn: {
      tp1_be: computeIfvgStats(json, entry, 'tp1_be', true),
      be_50:  computeIfvgStats(json, entry, 'be_50', true),
      no_be:  computeIfvgStats(json, entry, 'no_be', true),
    },
    smtOff: {
      tp1_be: computeIfvgStats(json, entry, 'tp1_be', false),
      be_50:  computeIfvgStats(json, entry, 'be_50', false),
      no_be:  computeIfvgStats(json, entry, 'no_be', false),
    },
  };
}

// Event name → IFVG SMT slug mapping per asset (NQ + GC)
const EVENT_SLUG_MAP: Record<string, { nq: string | null; gc: string | null; es: string | null }> = {
  // ── Backtested (have IFVG SMT JSONs) ──────────────────────────────────────
  'CPI':                              { nq: 'cpi-ifvg-smt',                gc: 'cpi-ifvg-smt-gc',                es: 'cpi-ifvg-smt-es' },
  'Core CPI':                         { nq: 'cpi-ifvg-smt',                gc: 'cpi-ifvg-smt-gc',                es: 'cpi-ifvg-smt-es' },
  'NFP':                              { nq: 'nfp-ifvg-smt',                gc: 'nfp-ifvg-smt-gc',                es: 'nfp-ifvg-smt-es' },
  'Non-Farm Payrolls':                { nq: 'nfp-ifvg-smt',                gc: 'nfp-ifvg-smt-gc',                es: 'nfp-ifvg-smt-es' },
  'PPI':                              { nq: 'ppi-ifvg-smt',                gc: 'ppi-ifvg-smt-gc',                es: 'ppi-ifvg-smt-es' },
  'PCE':                              { nq: 'pce-ifvg-smt',                gc: null,                              es: 'pce-ifvg-smt-es' },
  'Core PCE':                         { nq: 'pce-ifvg-smt',                gc: null,                              es: 'pce-ifvg-smt-es' },
  'Jobless Claims':                   { nq: 'joblessclaims-ifvg-smt',      gc: 'joblessclaims-ifvg-smt-gc',      es: 'joblessclaims-ifvg-smt-es' },
  'Initial Jobless Claims':           { nq: 'joblessclaims-ifvg-smt',      gc: 'joblessclaims-ifvg-smt-gc',      es: 'joblessclaims-ifvg-smt-es' },
  'Retail Sales':                     { nq: 'retailsales-ifvg-smt',        gc: 'retailsales-ifvg-smt-gc',        es: 'retailsales-ifvg-smt-es' },
  'Core Retail Sales':                { nq: 'retailsales-ifvg-smt',        gc: 'retailsales-ifvg-smt-gc',        es: 'retailsales-ifvg-smt-es' },
  'Empire State Manufacturing':       { nq: 'empirestate-ifvg-smt',        gc: 'empirestate-ifvg-smt-gc',        es: 'empirestate-ifvg-smt-es' },
  'Empire State Manufacturing Index': { nq: 'empirestate-ifvg-smt',        gc: 'empirestate-ifvg-smt-gc',        es: 'empirestate-ifvg-smt-es' },
  'Employment Cost Index':            { nq: 'employmentcostindex-ifvg-smt',gc: 'employmentcostindex-ifvg-smt-gc',es: 'employmentcostindex-ifvg-smt-es' },
  'GDP':                              { nq: 'gdp-ifvg-smt',                gc: 'gdp-ifvg-smt-gc',                es: 'gdp-ifvg-smt-es' },
  'FOMC Statement':                   { nq: 'fomc-ifvg-smt',               gc: 'fomc-ifvg-smt-gc',               es: 'fomc-ifvg-smt-es' },
  'Federal Funds Rate':               { nq: 'fomc-ifvg-smt',               gc: 'fomc-ifvg-smt-gc',               es: 'fomc-ifvg-smt-es' },
  'ADP Non-Farm Employment Change':   { nq: 'adp-ifvg-smt',                gc: 'adp-ifvg-smt-gc',                es: 'adp-ifvg-smt-es' },
  'ADP':                              { nq: 'adp-ifvg-smt',                gc: 'adp-ifvg-smt-gc',                es: 'adp-ifvg-smt-es' },
  'JOLTS Job Openings':               { nq: 'jolts-ifvg-smt',              gc: 'jolts-ifvg-smt-gc',              es: 'jolts-ifvg-smt-es' },
  'JOLTS':                            { nq: 'jolts-ifvg-smt',              gc: 'jolts-ifvg-smt-gc',              es: 'jolts-ifvg-smt-es' },
  'ISM Manufacturing PMI':                 { nq: 'ism-mfg-ifvg-smt',      gc: 'ism-mfg-ifvg-smt-gc',            es: 'ism-mfg-ifvg-smt-es' },
  'ISM Services PMI':                      { nq: 'ism-services-ifvg-smt', gc: 'ism-services-ifvg-smt-gc',       es: 'ism-services-ifvg-smt-es' },
  'ISM Non-Manufacturing PMI':             { nq: 'ism-services-ifvg-smt', gc: 'ism-services-ifvg-smt-gc',       es: 'ism-services-ifvg-smt-es' },
  'CB Consumer Confidence':                { nq: null, gc: null, es: null },
  'Philadelphia Fed Manufacturing Index':  { nq: null, gc: 'philly-fed-ifvg-smt-gc',         es: null },
  'Durable Goods Orders':                  { nq: 'durable-goods-ifvg-smt', gc: 'durable-goods-ifvg-smt-gc',       es: 'durable-goods-ifvg-smt-es' },
  'Core Durable Goods Orders':             { nq: 'durable-goods-ifvg-smt', gc: 'durable-goods-ifvg-smt-gc',       es: 'durable-goods-ifvg-smt-es' },
  // ── FF red folder, no backtest yet (visible with "No backtest yet" badge) ─
  'FOMC Minutes':                          { nq: null, gc: null, es: null },
};

export type EventStudyStats = {
  slug: string;
  pf: number;
  n: number;
  net: number;
  wr: number;
  asset: string;
};

export function getEventStudyMap(
  news: Array<{ event: string }>,
  asset: 'nq' | 'gc' | 'es' = 'nq',
): Record<string, EventStudyStats | null> {
  const map: Record<string, EventStudyStats | null> = {};
  for (const item of news) {
    if (!(item.event in map)) {
      map[item.event] = getStudyForEvent(item.event, asset);
    }
  }
  return map;
}

function getStudyForEvent(
  eventName: string,
  asset: 'nq' | 'gc' | 'es' = 'nq',
): EventStudyStats | null {
  const entry = EVENT_SLUG_MAP[eventName];
  if (!entry) return null;                // unknown event
  const slug = entry[asset];
  if (!slug) return null;                  // known event, no study for this asset
  const stats = getStrategyStats(slug);
  if (!stats) return null;
  return { slug, pf: stats.pf, n: stats.n, net: stats.net, wr: stats.wr, asset: stats.asset };
}

// Returns weekday breakdown for an IFVG SMT slug (tp1_be smt=True)
// Day 0 = Monday (Python weekday: Mon=0 ... Fri=4)
export function getWeekdayBreakdown(slug: string, smtOn = true): WeekdayBreakdown {
  const empty: WeekdayStats = { n: 0, w: 0, net: 0, wr: 0 };
  const acc: Record<number, { n: number; w: number; net: number }> = {
    0: { n: 0, w: 0, net: 0 },
    1: { n: 0, w: 0, net: 0 },
    2: { n: 0, w: 0, net: 0 },
    3: { n: 0, w: 0, net: 0 },
    4: { n: 0, w: 0, net: 0 },
  };

  const json = loadIfvgJson(slug);
  if (!json) return { mon: empty, tue: empty, wed: empty, thu: empty, fri: empty };

  const trades = (json.trades ?? []).filter(
    (t) => t.variant === 'tp1_be' && (smtOn ? t.smt === true : true)
  );

  for (const t of trades) {
    if (!t.ts) continue;
    // ts is ISO timestamp string like "2016-04-19T12:30:00+00:00"
    const d = new Date(t.ts);
    // Convert to ET: ET = UTC-5 (EST) or UTC-4 (EDT)
    // Use UTC date shifted by ET offset approximation
    // For weekday, we look at ET date. ET = UTC - 4 or 5 hours.
    // The release is always at 8:30 ET, so UTC time is 12:30 or 13:30.
    // We subtract 5h to get approximate ET date for weekday.
    const etMs = d.getTime() - 5 * 60 * 60 * 1000;
    const etDate = new Date(etMs);
    // getDay() returns 0=Sun, 1=Mon ... 5=Fri, 6=Sat
    const dayJs = etDate.getUTCDay(); // use UTC since we manually shifted
    // Map JS day (1=Mon..5=Fri) to 0=Mon..4=Fri
    const day = dayJs - 1; // Mon=0, Fri=4
    if (day < 0 || day > 4) continue; // skip weekends
    acc[day].n++;
    if (t.pnl_pts > 0) acc[day].w++;
    acc[day].net += t.pnl_pts;
  }

  const toStat = (d: { n: number; w: number; net: number }): WeekdayStats => ({
    n: d.n,
    w: d.w,
    net: Math.round(d.net * 10) / 10,
    wr: d.n > 0 ? Math.round((d.w / d.n) * 100) : 0,
  });

  return {
    mon: toStat(acc[0]),
    tue: toStat(acc[1]),
    wed: toStat(acc[2]),
    thu: toStat(acc[3]),
    fri: toStat(acc[4]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Year breakdown
// ─────────────────────────────────────────────────────────────────────────────

export type YearStats = {
  year: number;
  n: number;
  w: number;
  be: number;
  l: number;
  net: number;
  wr: number;
  bePct: number;
  lPct: number;
  pf: number;
  avgWin: number;
  avgLoss: number;
  maxDD: number;
};
export type YearBreakdown = YearStats[]; // sorted asc by year

// ─────────────────────────────────────────────────────────────────────────────
// Trade list
// ─────────────────────────────────────────────────────────────────────────────

export type TradeRow = {
  ts: string;
  year: number;
  side: string;
  pnl_pts: number;
  outcome: string;
  entry_price?: number;
  sl_price?: number;
  tp_price?: number;
  entry_ts?: string;
  exit_ts?: string;
  exit_price?: number;
  data_high?: number;
  data_low?: number;
  sweep_ts?: string;
  sweep_side?: 'UP' | 'DOWN';
  ifvg_top?: number;
  ifvg_bottom?: number;
  ifvg_formation_ts?: string;
  x_stop?: number;
  y_tp?: number;
  ib_high?: number;
  ib_low?: number;
};

type PriceOverlayRow = {
  ts: string;
  entry_ts: string;
  variant: string;
  smt: boolean;
  side: string;
  entry_price: number;
  sl_price: number;
  tp_price: number;
  exit_ts: string;
  exit_price: number;
  data_high?: number;
  data_low?: number;
  sweep_ts?: string;
  sweep_side?: 'UP' | 'DOWN';
  ifvg_top?: number;
  ifvg_bottom?: number;
  ifvg_formation_ts?: string;
};

type PriceOverlayFile = {
  prices: PriceOverlayRow[];
};

type PriceFields = Pick<PriceOverlayRow, 'entry_price' | 'sl_price' | 'tp_price' | 'entry_ts' | 'exit_ts' | 'exit_price'> & {
  data_high?: number;
  data_low?: number;
  sweep_ts?: string;
  sweep_side?: 'UP' | 'DOWN';
  ifvg_top?: number;
  ifvg_bottom?: number;
  ifvg_formation_ts?: string;
};

function normTs(ts: string): string {
  try { return new Date(ts).toISOString(); } catch { return ts; }
}

function loadPriceOverlay(slug: string): Map<string, PriceFields> | null {
  const overlaySlug = slug;
  const p = path.join(dataDir, `${overlaySlug}-trade-prices.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as PriceOverlayFile;
    const map = new Map<string, PriceFields>();
    for (const row of data.prices ?? []) {
      const key = `${normTs(row.ts)}|${row.variant}|${String(row.smt)}|${String(row.side).toLowerCase()}`;
      map.set(key, {
        entry_price: row.entry_price,
        sl_price: row.sl_price,
        tp_price: row.tp_price,
        entry_ts: row.entry_ts,
        exit_ts: row.exit_ts,
        exit_price: row.exit_price,
        data_high: row.data_high,
        data_low: row.data_low,
        sweep_ts: row.sweep_ts,
        sweep_side: row.sweep_side,
        ifvg_top: row.ifvg_top,
        ifvg_bottom: row.ifvg_bottom,
        ifvg_formation_ts: row.ifvg_formation_ts,
      });
    }
    return map;
  } catch {
    return null;
  }
}

export function getTradeList(slug: string, smtOn = true, variant: 'tp1_be' | 'be_50' | 'no_be' = 'tp1_be'): TradeRow[] {
  const json = loadIfvgJson(slug);
  if (!json) return [];

  const overlay = loadPriceOverlay(slug);

  return (json.trades ?? [])
    .filter((t) => t.variant === variant && (smtOn ? t.smt === true : true))
    .map((t) => {
      const sideNorm = t.side.toLowerCase();
      const priceFields: Partial<PriceFields> = overlay
        ? (overlay.get(`${normTs(t.ts)}|${t.variant}|${String(t.smt)}|${sideNorm}`) ?? {})
        : {};
      return {
        ts: t.ts,
        year: typeof t.year === 'number' ? t.year : Number(t.year) || new Date(t.ts).getUTCFullYear(),
        side: sideNorm,
        pnl_pts: Math.round(t.pnl_pts * 100) / 100,
        outcome: t.outcome,
        ...priceFields,
      };
    })
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

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
    // No JSON data — render as study with excerpt teaser
    kind = 'study';
    stats = {
      pf: 0, n: 0, edgePts: 0, wr: 0,
      wrByWeekday: [0, 0, 0, 0, 0],
      nByWeekday: [0, 0, 0, 0, 0],
    };
    if (excerpt) {
      descriptive = {
        primaryValue: '—',
        primaryLabel: 'no data',
        secondaryValue: date,
        secondaryLabel: asset,
        tertiary: excerpt,
      };
    }
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

// ── Straddle trade list / stats (for the 5-asset straddle explorer) ──────────

const STRADDLE_SLUGS = ['cpi-day-stats', 'nfp', 'jobless-claims', 'ppi', 'retail-sales', 'durable-goods', 'pce'];

interface StraddleTrade {
  date: string;
  ts: string;
  entry_price: number;
  X: number;
  Y: number;
  buy_stop: number;
  sell_stop: number;
  tp_buy: number;
  tp_sell: number;
  filled_side: string | null;
  fill_ts: string | null;
  fill_price: number | null;
  exit_ts: string | null;
  exit_price: number | null;
  pnl: number;
  outcome: string;
}

interface StraddleTradesJson {
  event: string;
  generated_at: string;
  combos: Array<{
    X: number;
    Y: number;
    trades: StraddleTrade[];
  }>;
}

function loadStraddleTrades(slug: string, asset: string): StraddleTradesJson | null {
  const base = path.join(dataDir);
  const dataKey = slug === 'cpi-day-stats' ? 'cpi' : slug;
  const suffix = asset === 'nq' ? '' : `-${asset}`;
  const fp = path.join(base, `${dataKey}-straddle-trades${suffix}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as StraddleTradesJson;
  } catch {
    return null;
  }
}

const STRADDLE_STOPS: Record<string, number[]> = {
  nq: [25, 30, 35, 40],
  es: [5, 6, 7, 8],
  ym: [50, 60, 70, 80],
  gc: [3, 4, 5, 6],
  si: [0.05, 0.07, 0.10, 0.12],
};

const STRADDLE_TPS: Record<string, number[]> = {
  nq: [15, 20, 25],
  es: [3, 4, 5],
  ym: [30, 40, 50],
  gc: [2, 2.5, 3],
  si: [0.03, 0.05, 0.07],
};

export function getStraddleStopGrid(asset: string): number[] {
  return STRADDLE_STOPS[asset] ?? STRADDLE_STOPS.nq;
}

export function getStraddleTpGrid(asset: string): number[] {
  return STRADDLE_TPS[asset] ?? STRADDLE_TPS.nq;
}

export function getStraddleAllTrades(slug: string, asset: string): TradeRow[] {
  const dataKey = slug === 'cpi-day-stats' ? 'cpi' : slug;
  const suffix = asset === 'nq' ? '' : `-${asset}`;
  const fp = path.join(dataDir, `${dataKey}-straddle-trades${suffix}.json`);
  if (!fs.existsSync(fp)) return [];

  let json: StraddleTradesJson;
  try {
    json = JSON.parse(fs.readFileSync(fp, 'utf-8')) as StraddleTradesJson;
  } catch {
    return [];
  }

  const allTrades: TradeRow[] = [];
  for (const combo of json.combos) {
    for (const t of combo.trades) {
      if (!t.filled_side) continue;
      const ts = t.fill_ts || t.ts;
      const tpPrice = t.filled_side === 'long' ? t.tp_buy : t.filled_side === 'short' ? t.tp_sell : undefined;
      allTrades.push({
        ts,
        year: new Date(t.ts).getUTCFullYear(),
        side: t.filled_side,
        pnl_pts: Math.round(t.pnl * 100) / 100,
        outcome: (() => {
          const o = t.outcome ?? '';
          if (o === 'tp_hit') return 'win';
          if (o === 'sl_hit') return 'loss';
          if (o.startsWith('expired')) return t.pnl > 0 ? 'win' : t.pnl < 0 ? 'expired' : 'flat';
          return o;
        })(),
        x_stop: combo.X,
        y_tp: combo.Y,
        entry_price: t.fill_price ?? t.entry_price,
        sl_price: undefined,
        tp_price: tpPrice,
        entry_ts: t.fill_ts || undefined,
        exit_ts: t.exit_ts || undefined,
        exit_price: t.exit_price ?? undefined,
      });
    }
  }

  return allTrades.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

export function getStraddleTradeList(slug: string, asset: string, stopKey: number, tpKey: number, sideFilter: 'long' | 'short' | 'all'): TradeRow[] {
  const json = loadStraddleTrades(slug, asset);
  if (!json) return [];

  const combo = json.combos.find((c) => c.X === stopKey && c.Y === tpKey);
  if (!combo) return [];

  return combo.trades
    .filter((t) => {
      if (sideFilter === 'all') return true;
      return t.filled_side === sideFilter;
    })
    .map((t) => {
      const ts = t.fill_ts || t.ts;
      const entryTs = t.fill_ts || undefined;
      const exitTs = t.exit_ts || undefined;
      const entryPrice = t.fill_price ?? t.entry_price;
      const exitPrice = t.exit_price ?? undefined;
      const tpPrice = t.filled_side === 'long' ? t.tp_buy : t.filled_side === 'short' ? t.tp_sell : undefined;
      return {
        ts,
        year: new Date(t.ts).getUTCFullYear(),
        side: t.filled_side || 'unknown',
        pnl_pts: Math.round(t.pnl * 100) / 100,
        outcome: t.outcome === 'tp_hit' ? 'win' : t.outcome === 'sl_hit' ? 'loss' : t.outcome === 'expired' ? 'timeout' : t.outcome,
        x_stop: stopKey,
        y_tp: tpKey,
        entry_price: entryPrice,
        sl_price: undefined,
        tp_price: tpPrice,
        entry_ts: entryTs,
        exit_ts: exitTs,
        exit_price: exitPrice,
      };
    })
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

export function getStraddleStats(
  slug: string, asset: string, stopKey: number, tpKey: number, sideFilter: 'long' | 'short' | 'all',
): { pf: number; n: number; net: number; wr: number; dateFrom: string; dateTo: string } {
  const json = loadStraddleTrades(slug, asset);
  if (!json) return { pf: 0, n: 0, net: 0, wr: 0, dateFrom: '', dateTo: '' };

  const combo = json.combos.find((c) => c.X === stopKey && c.Y === tpKey);
  if (!combo) return { pf: 0, n: 0, net: 0, wr: 0, dateFrom: '', dateTo: '' };

  const trades = sideFilter === 'all'
    ? combo.trades
    : combo.trades.filter((t) => t.filled_side === sideFilter);

  const n = trades.length;
  if (n === 0) return { pf: 0, n: 0, net: 0, wr: 0, dateFrom: '', dateTo: '' };

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const winPnl = wins.reduce((s, t) => s + t.pnl, 0);
  const lossPnl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const net = trades.reduce((s, t) => s + t.pnl, 0);
  const pf = lossPnl > 0 ? winPnl / lossPnl : winPnl > 0 ? 99 : 0;
  const wr = Math.round((wins.length / n) * 100);

  const dates = trades.map((t) => t.date).sort();
  return {
    pf: Math.round(pf * 100) / 100,
    n,
    net: Math.round(net * 100) / 100,
    wr,
    dateFrom: dates[0] ?? '',
    dateTo: dates[dates.length - 1] ?? '',
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

// Distinct underlying event/setup key for a study slug.
// Collapses asset ports (-gc/-es/-si/-ym, __asset) and analysis variants
// (-ifvg-smt*, -day-stats*) onto the one event they describe.
// Returns null for the multi-event asset rollup cards (es/si/nq-ifvg-smt) — those are not a single event.
export function eventKeyOf(slug: string): string | null {
  let s = slug.replace(/__(nq|gc|es|si|ym)$/, '');
  s = s.replace(/-ifvg-smt.*$/, '');
  s = s.replace(/-day-stats.*$/, '');
  s = s.replace(/-(gc|es|si|ym)$/, '');
  if (s === 'joblessclaims') s = 'jobless-claims';
  if (s === 'retailsales') s = 'retail-sales';
  if (s === 'es' || s === 'si' || s === 'nq') return null;
  return s;
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
    const events: NavEvent[] = [...evMap.entries()]
      .map(([key, arr]) => ({ key, label: eventFull(key), count: arr.length, bestPf: Math.max(...arr.map((x) => x.pf)) }))
      .sort((a, b) => b.bestPf - a.bestPf);
    out.push({ family: fam.family, label: fam.label, cat: fam.cat, count: items.length, events });
  }
  return out;
}
