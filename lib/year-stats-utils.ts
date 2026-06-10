import type { TradeRow, YearStats } from './study-stats';

/**
 * Total row for the year table — computed from the raw trade list
 * (not from rounded per-year rows) so PF and maxDD are exact:
 * - PF = unrounded won points / unrounded lost points
 * - maxDD = true cumulative drawdown over the full date-sorted sequence
 *   (catches drawdowns spanning a year boundary)
 * Win/BE/Loss classification matches computeYearBreakdown (BE = pnl == 0).
 */
export function aggregateYearTotals(trades: TradeRow[]): YearStats {
  if (trades.length === 0) {
    return { year: 0, n: 0, w: 0, be: 0, l: 0, net: 0, wr: 0, bePct: 0, lPct: 0, pf: 0, avgWin: 0, avgLoss: 0, maxDD: 0 };
  }

  const sorted = [...trades].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  let n = 0, w = 0, be = 0, l = 0, net = 0;
  let winPts = 0, lossPts = 0;
  for (const t of sorted) {
    n++;
    net += t.pnl_pts;
    if (t.pnl_pts > 0) {
      w++; winPts += t.pnl_pts;
    } else if (t.pnl_pts < 0) {
      l++; lossPts += Math.abs(t.pnl_pts);
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
    year: 0,
    n,
    w,
    be,
    l,
    net: Math.round(net * 10) / 10,
    wr: n > 0 ? Math.round((w / n) * 100) : 0,
    bePct: n > 0 ? Math.round((be / n) * 100) : 0,
    lPct: n > 0 ? Math.round((l / n) * 100) : 0,
    pf: Math.round(pf * 100) / 100,
    avgWin: w > 0 ? Math.round((winPts / w) * 10) / 10 : 0,
    avgLoss: l > 0 ? Math.round((lossPts / l) * 10) / 10 : 0,
    maxDD: Math.round(maxDD * 10) / 10,
  };
}
