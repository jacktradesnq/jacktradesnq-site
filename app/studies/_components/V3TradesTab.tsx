'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import type { TradeRow } from '@/lib/strategy-stats';
import { LOOKBACK_LABELS } from '@/lib/lookback-labels';
import TradeMiniChart from './TradeMiniChart';

// V3Tabs « Trade list » tab.
const PAGE_SIZE = 25;

const DAY_LABEL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday',
};

function tradeWeekday(ts: string): number {
  // Convert UTC timestamp to ET (subtract 5h) then get day
  const d = new Date(new Date(ts).getTime() - 5 * 3600 * 1000);
  return d.getUTCDay(); // 1=Mon...5=Fri
}

const DAY_KEY_TO_NUM: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };

type VariantKey = string;

export const VARIANT_LABELS: Record<string, string> = {
  tp1_be: 'TP1 + BE',
  be_50:  'TP only + BE',
  no_be:  'TP only',
};

export function TradesBlock({
  trades,
  tradesByVariant,
  variant,
  setVariant,
  dayFilter = '',
  yearFilter = '',
  onClearYearFilter,
  slug,
  eventShort,
  asset,
  smtLabel = 'SMT-on',
  filterLabel,
  barsSlug,
  totalTradesCount = 0,
}: {
  trades: TradeRow[];
  tradesByVariant?: { tp1_be: TradeRow[]; be_50: TradeRow[]; no_be: TradeRow[] };
  variant: VariantKey;
  setVariant: (v: VariantKey) => void;
  dayFilter?: string;
  yearFilter?: string;
  onClearYearFilter?: () => void;
  slug: string;
  eventShort: string;
  asset: 'nq' | 'gc' | 'es' | 'si' | 'ym';
  smtLabel?: string;
  filterLabel?: string;
  barsSlug?: string;
  totalTradesCount?: number;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const lookback = sp.get('lookback') || 'all';

  const activeTrades = tradesByVariant ? (tradesByVariant as Record<string, TradeRow[]>)[variant] ?? trades : trades;
  const dayFiltered = dayFilter && DAY_KEY_TO_NUM[dayFilter] !== undefined
    ? activeTrades.filter((t: TradeRow) => tradeWeekday(t.ts) === DAY_KEY_TO_NUM[dayFilter])
    : activeTrades;
  const filtered = yearFilter
    ? dayFiltered.filter((t: TradeRow) => t.ts.slice(0, 4) === yearFilter)
    : dayFiltered;

  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (activeTrades.length === 0 && lookback !== 'all' && totalTradesCount > 0) {
    return (
      <div className="v3-coming-soon">
        No trade data in the last {LOOKBACK_LABELS[lookback] ?? lookback}.
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

  if (activeTrades.length === 0 && totalTradesCount > 0) {
    return (
      <div className="v3-coming-soon">
        No trades for this filter combo.
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

  if (trades.length === 0) {
    return <div className="v3-coming-soon">No trade data available.</div>;
  }

  const shown = filtered.slice(0, visible);

  function pnlClass(pnl: number) {
    if (pnl > 0) return 'v3-tr-pnl pos';
    if (pnl < 0) return 'v3-tr-pnl neg';
    return 'v3-tr-pnl zero';
  }

  function outcomeClass(outcome: string) {
    if (outcome === 'win') return 'v3-tr-badge win';
    if (outcome === 'loss') return 'v3-tr-badge loss';
    if (outcome === 'timeout') return 'v3-tr-badge timeout';
    return 'v3-tr-badge be';
  }

  const hasStructuralPrices = trades.some((t) => t.entry_price !== undefined && t.sl_price !== undefined && t.tp_price !== undefined);

  return (
    <div>
      <div className="v3-wd-h">Trade list</div>
      <div className="v3-wd-sub">
        {filterLabel ?? `${VARIANT_LABELS[variant]} · ${smtLabel} variant`}{hasStructuralPrices && !filterLabel ? ' · SL = sweep ± 1 tick · TP = pre-news pivot (structural, varies per trade)' : ''} · most recent first.
      </div>
      <div className="v3-tr-table-wrap">
        <table className="v3-tr-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Side</th>
              <th>PnL (pts)</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t, i) => (
              <Fragment key={i}>
                <tr
                  className={'v3-tr-row' + (expandedIdx === i ? ' expanded' : '')}
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="v3-tr-date">
                    <span className="v3-tr-expand-icon">{expandedIdx === i ? '▾' : '▸'}</span>
                    {t.ts.slice(0, 10)}
                  </td>
                  <td className="v3-tr-side">{t.side.toUpperCase()}</td>
                  <td className={pnlClass(t.pnl_pts)}>
                    {t.pnl_pts >= 0 ? '+' : ''}{t.pnl_pts.toFixed(2)}
                  </td>
                  <td>
                    <span className={outcomeClass(t.outcome)}>{t.outcome}</span>
                  </td>
                </tr>
                {expandedIdx === i && (
                  <tr key={`${i}-chart`} className="v3-tr-expanded">
                    <td colSpan={4} style={{ padding: '16px 16px 24px' }}>
                      <TradeMiniChart
                        key={`${t.ts}-${t.tp_price ?? ''}-${t.sl_price ?? ''}-${t.side}`}
                        eventShort={eventShort}
                        asset={asset}
                        tradeDate={t.ts.slice(0, 10)}
                        side={t.side as 'long' | 'short'}
                        pnl_pts={t.pnl_pts}
                        outcome={t.outcome}
                        entryPrice={t.entry_price}
                        slPrice={t.sl_price}
                        tpPrice={t.tp_price}
                        entryTs={t.entry_ts}
                        exitTs={t.exit_ts}
                        exitPrice={t.exit_price}
                        ts={t.ts}
                        dataHigh={t.data_high}
                        dataLow={t.data_low}
                        sweepTs={t.sweep_ts}
                        sweepSide={t.sweep_side}
                        ifvgTop={t.ifvg_top}
                        ifvgBottom={t.ifvg_bottom}
                        ifvgFormationTs={t.ifvg_formation_ts}
                        ibHigh={t.ib_high}
                        ibLow={t.ib_low}
                        variant={variant}
                        barsSlug={barsSlug as string | undefined}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {dayFilter && DAY_LABEL[dayFilter] && (
        <div className="v3-tr-filter-badge">
          Filtered by {DAY_LABEL[dayFilter]} ·{' '}
          <Link href={`/studies/${slug}/?tab=trades`} className="v3-tr-clear">× clear</Link>
        </div>
      )}
      {yearFilter && (
        <div className="v3-tr-filter-badge">
          Year: {yearFilter}{' '}
          {onClearYearFilter ? (
            <button type="button" onClick={onClearYearFilter} className="v3-tr-clear">✕</button>
          ) : (
            <Link href={`/studies/${slug}/?tab=trades`} className="v3-tr-clear">✕</Link>
          )}
        </div>
      )}
      {visible < filtered.length && (
        <button
          className="v3-tr-load-more"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        >
          Load more ({filtered.length - visible} remaining)
        </button>
      )}
      <div className="v3-tr-count">{filtered.length} total trades{dayFilter ? ` (${trades.length} unfiltered)` : ''}</div>
    </div>
  );
}
