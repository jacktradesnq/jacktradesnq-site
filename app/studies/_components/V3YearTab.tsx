'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import type { YearBreakdown, TradeRow } from '@/lib/strategy-stats';
import { aggregateYearTotals } from '@/lib/year-stats-utils';
import { LOOKBACK_LABELS } from '@/lib/lookback-labels';
import EquityCurve from './EquityCurve';
import DailyPnlBars from './DailyPnlBars';
import StraddleCylinders from './StraddleCylinders';

// V3Tabs « By year » tab.
export function YearBlock({ breakdown, slug, smtLabel = 'SMT-on', trades = [], onJumpToTrades, isStraddle = false, totalTradesCount = 0 }: { breakdown: YearBreakdown; slug: string; smtLabel?: string; trades?: TradeRow[]; onJumpToTrades?: (year: number) => void; isStraddle?: boolean; totalTradesCount?: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const lookback = sp.get('lookback') || 'all';
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const filteredTrades = useMemo(
    () => (selectedYear !== null ? trades.filter((t) => t.year === selectedYear) : trades),
    [trades, selectedYear]
  );

  if (breakdown.length === 0 && lookback !== 'all' && totalTradesCount > 0) {
    return (
      <div className="v3-coming-soon">
        No year data in the last {LOOKBACK_LABELS[lookback] ?? lookback}.
        <br />
        <button type="button" className="v3-empty-cta" onClick={() => {
          const params = new URLSearchParams(sp.toString());
          params.set('lookback', 'all');
          router.replace(`/studies/${slug}/?${params.toString()}`, { scroll: false });
        }}>
          View all-time data ({totalTradesCount} trades)
        </button>
      </div>
    );
  }

  if (breakdown.length === 0) {
    if (totalTradesCount > 0) {
      return (
        <div className="v3-coming-soon">
          No year data for this filter combo.
          <br />
          <button type="button" className="v3-empty-cta" onClick={() => {
            const params = new URLSearchParams(sp.toString());
            params.delete('variant'); params.delete('tp'); params.delete('smt'); params.delete('outcome');
            router.replace(`/studies/${slug}/?${params.toString()}`, { scroll: false });
          }}>
            Reset filters
          </button>
        </div>
      );
    }
    return <div className="v3-coming-soon">No year data available.</div>;
  }

  const best = breakdown.reduce((a, b) => (a.net >= b.net ? a : b));
  const worst = breakdown.reduce((a, b) => (a.net <= b.net ? a : b));
  const total = aggregateYearTotals(trades);

  function pctClass(val: number, type: 'win' | 'be' | 'loss') {
    if (type === 'win') return val >= 50 ? 'v3-yr-num sage' : 'v3-yr-num';
    if (type === 'loss') return val >= 50 ? 'v3-yr-num terra' : 'v3-yr-num';
    return 'v3-yr-num gold';
  }

  function renderRow(y: typeof breakdown[0] | typeof total, isTotal = false) {
    const cls = 'v3-yr-row' +
      (isTotal ? ' total' : selectedYear === y.year ? ' selected' : '');
    const onClick = isTotal ? undefined : () => {
      if (onJumpToTrades && y.year !== undefined) {
        onJumpToTrades(y.year as number);
      } else {
        setSelectedYear(selectedYear === y.year ? null : y.year);
      }
    };

    return (
      <tr
        key={isTotal ? 'total' : y.year}
        className={cls}
        onClick={onClick}
        style={isTotal ? { cursor: 'default' } : { cursor: 'pointer' }}
      >
        <td className="v3-yr-year">{isTotal ? 'Total' : y.year}</td>
        <td className="v3-yr-num">{y.n}</td>
        <td className={pctClass(y.wr, 'win')}>{y.wr}%</td>
        <td className={pctClass(y.bePct, 'be')}>{y.bePct}%</td>
        <td className={pctClass(y.lPct, 'loss')}>{y.lPct}%</td>
        <td className="v3-yr-num">{y.pf.toFixed(2)}</td>
        <td className="v3-yr-num sage">{y.avgWin > 0 ? `+${y.avgWin}` : '—'}</td>
        <td className="v3-yr-num terra">{y.avgLoss > 0 ? `-${y.avgLoss}` : '—'}</td>
        <td className="v3-yr-num terra">{y.maxDD < 0 ? y.maxDD.toFixed(1) : '—'}</td>
      </tr>
    );
  }

  return (
    <div>
      <div className="v3-wd-h">Performance by year</div>
      <div className="v3-wd-sub">Real data — {smtLabel} variant · tp1_be. Click a row to jump to trades from that year.</div>
      <div className="v3-yr-table-wrap">
        <table className="v3-yr-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>N</th>
              <th>Win%</th>
              <th>BE%</th>
              <th>Loss%</th>
              <th>PF</th>
              <th>Avg Win</th>
              <th>Avg Loss</th>
              <th>Max DD</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((y) => renderRow(y, false))}
            {renderRow(total, true)}
          </tbody>
        </table>
      </div>
      <div className="v3-wd-verdict">
        Best year: <strong>{best.year}</strong> ({best.wr}% WR · {best.net >= 0 ? '+' : ''}{best.net} pts net).
        {worst.year !== best.year && (
          <> Worst: <strong>{worst.year}</strong> ({worst.wr}% WR · {worst.net} pts net).</>
        )}
      </div>
      {trades.length > 0 && (
        <>
          {selectedYear !== null && (
            <div className="v3-yr-filter-pill">
              <span>Filtered on {selectedYear}</span>
              <button
                type="button"
                onClick={() => setSelectedYear(null)}
                aria-label="Reset year filter"
              >
                ×
              </button>
            </div>
          )}
          {isStraddle ? (
            <StraddleCylinders trades={filteredTrades} />
          ) : (
            <div className="eq-pair-wrap">
              <EquityCurve trades={filteredTrades} title="Equity curve" subtitle={selectedYear ? `${selectedYear} · ${smtLabel}` : `Cumulative PnL · ${smtLabel}`} />
              <DailyPnlBars trades={filteredTrades} title="Trade-by-trade PnL" subtitle={selectedYear ? `${selectedYear} · per trade` : `Per trade · ${smtLabel}`} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
