import fs from 'fs';
import path from 'path';

import { MIN_DISPLAY_PF } from './study-display-config';

// Per-study strategy stats (IFVG combos, variants, weekday/year breakdowns, trade list).
const dataDir = path.join(process.cwd(), 'public', 'data');

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
