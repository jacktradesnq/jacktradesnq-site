// Client-side stat helpers — isomorphic (no fs/path).
// Used by V3Tabs to recompute KPI + breakdowns from raw trades after filter changes.

import type { TradeRow, YearStats, YearBreakdown, WeekdayStats, WeekdayBreakdown } from './strategy-stats';

type LookbackKey = '3mo' | '6mo' | '1y' | '5y' | 'all';

const LOOKBACK_MS: Record<LookbackKey, number> = {
  '3mo': 90   * 24 * 3600 * 1000,
  '6mo': 180  * 24 * 3600 * 1000,
  '1y':  365  * 24 * 3600 * 1000,
  '5y':  1825 * 24 * 3600 * 1000,
  'all': Infinity,
};

export function filterTradesByLookback(trades: TradeRow[], lookback: LookbackKey): TradeRow[] {
  if (lookback === 'all') return trades;
  const cutoff = Date.now() - LOOKBACK_MS[lookback];
  return trades.filter((t) => new Date(t.ts).getTime() >= cutoff);
}

export function computeKPI(trades: TradeRow[]): { pf: number; n: number; net: number; wr: number } {
  const n = trades.length;
  if (n === 0) return { pf: 0, n: 0, net: 0, wr: 0 };
  const wins = trades.filter((t) => t.pnl_pts > 0);
  const losses = trades.filter((t) => t.pnl_pts < 0);
  const winPnl = wins.reduce((s, t) => s + t.pnl_pts, 0);
  const lossPnl = Math.abs(losses.reduce((s, t) => s + t.pnl_pts, 0));
  const net = trades.reduce((s, t) => s + t.pnl_pts, 0);
  const pf = lossPnl > 0 ? winPnl / lossPnl : winPnl > 0 ? 99 : 0;
  const wr = Math.round((wins.length / n) * 100);
  return {
    pf: Math.round(pf * 100) / 100,
    n,
    net: Math.round(net * 10) / 10,
    wr,
  };
}

export function computeYearBreakdown(trades: TradeRow[]): YearBreakdown {
  const byYear: Record<number, TradeRow[]> = {};
  for (const t of trades) {
    const yr = t.year ?? new Date(t.ts).getUTCFullYear();
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(t);
  }

  return Object.entries(byYear)
    .map(([yr, trs]) => {
      const sorted = [...trs].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
      let n = 0, w = 0, be = 0, l = 0;
      let winPts = 0, lossPts = 0, net = 0;
      let winSum = 0, lossSum = 0;
      for (const t of sorted) {
        n++;
        net += t.pnl_pts;
        if (t.pnl_pts > 0) {
          w++; winPts += t.pnl_pts; winSum += t.pnl_pts;
        } else if (t.pnl_pts < 0) {
          l++; lossPts += Math.abs(t.pnl_pts); lossSum += Math.abs(t.pnl_pts);
        } else {
          be++; // only exact breakeven (pnl == 0)
        }
      }
      let cumul = 0, peak = 0, maxDD = 0;
      for (const t of sorted) {
        cumul += t.pnl_pts;
        if (cumul > peak) peak = cumul;
        const dd = cumul - peak;
        if (dd < maxDD) maxDD = dd;
      }
      const pf = lossPts > 0 ? winPts / lossPts : winPts > 0 ? 99 : 0;
      return {
        year: Number(yr),
        n, w, be, l,
        net: Math.round(net * 10) / 10,
        wr: n > 0 ? Math.round((w / n) * 100) : 0,
        bePct: n > 0 ? Math.round((be / n) * 100) : 0,
        lPct: n > 0 ? Math.round((l / n) * 100) : 0,
        pf: Math.round(pf * 100) / 100,
        avgWin: w > 0 ? Math.round((winSum / w) * 10) / 10 : 0,
        avgLoss: l > 0 ? Math.round((lossSum / l) * 10) / 10 : 0,
        maxDD: Math.round(maxDD * 10) / 10,
      } satisfies YearStats;
    })
    .sort((a, b) => a.year - b.year);
}

function tradeWeekdayET(ts: string): number {
  const d = new Date(new Date(ts).getTime() - 5 * 3600 * 1000);
  return d.getUTCDay(); // 1=Mon…5=Fri
}

function emptyWeekdayStat(): WeekdayStats {
  return { n: 0, w: 0, net: 0, wr: 0 };
}

export function computeWeekdayBreakdown(trades: TradeRow[]): WeekdayBreakdown {
  const acc: Record<number, { n: number; w: number; wins: number[]; losses: number[]; all: number[] }> = {
    1: { n: 0, w: 0, wins: [], losses: [], all: [] },
    2: { n: 0, w: 0, wins: [], losses: [], all: [] },
    3: { n: 0, w: 0, wins: [], losses: [], all: [] },
    4: { n: 0, w: 0, wins: [], losses: [], all: [] },
    5: { n: 0, w: 0, wins: [], losses: [], all: [] },
  };

  for (const t of trades) {
    const dow = tradeWeekdayET(t.ts);
    if (dow < 1 || dow > 5) continue;
    acc[dow].n++;
    acc[dow].all.push(t.pnl_pts);
    if (t.pnl_pts > 0) { acc[dow].w++; acc[dow].wins.push(t.pnl_pts); }
    else if (t.pnl_pts < 0) { acc[dow].losses.push(t.pnl_pts); }
  }

  function toStat(a: typeof acc[1]): WeekdayStats {
    const net = a.all.reduce((s, v) => s + v, 0);
    return {
      n: a.n,
      w: a.w,
      net: Math.round(net * 10) / 10,
      wr: a.n > 0 ? Math.round((a.w / a.n) * 100) : 0,
    };
  }

  return {
    mon: toStat(acc[1]),
    tue: toStat(acc[2]),
    wed: toStat(acc[3]),
    thu: toStat(acc[4]),
    fri: toStat(acc[5]),
  };
}
