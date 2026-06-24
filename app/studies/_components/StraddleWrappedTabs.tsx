'use client';

import { useMemo, Suspense } from 'react';
import { useAsset, type AssetKey } from './AssetContext';
import V3Tabs from './V3Tabs';
import type { TradeRow } from '@/lib/study-stats';
import { computeKPI, computeWeekdayBreakdown } from '@/lib/client-stats';
import { assetShort, eventFull } from '@/lib/terminology';

const STOP_GRIDS: Record<string, number[]> = {
  nq: [25, 30, 35, 40],
  es: [5, 6, 7, 8],
  ym: [50, 60, 70, 80],
  gc: [3, 4, 5, 6],
  si: [0.05, 0.07, 0.10, 0.12],
};

const TP_GRIDS: Record<string, number[]> = {
  nq: [15, 20, 25],
  es: [3, 4, 5],
  ym: [30, 40, 50],
  gc: [2, 2.5, 3],
  si: [0.03, 0.05, 0.07],
};

const SIDE_OPTS = [
  { key: 'both', label: 'Both' },
  { key: 'long', label: 'Long' },
  { key: 'short', label: 'Short' },
];

function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
}

const ASSET_LABEL: Record<string, string> = {
  nq: assetShort('nq'),
  gc: assetShort('gc'),
  si: assetShort('si'),
  ym: assetShort('ym'),
  es: assetShort('es'),
};

export default function StraddleWrappedTabs({
  slug,
  allTrades,
  barsSlug,
  eventName,
  releaseTime,
  dateFrom,
  dateTo,
  overviewContent,
  simpleModeIntroHtml,
}: {
  slug: string;
  allTrades: Record<string, TradeRow[]>;
  barsSlug: string;
  eventName: string;
  releaseTime?: string;
  dateFrom: string;
  dateTo: string;
  overviewContent: React.ReactNode;
  /** First paragraph HTML for Simple mode — passed through to V3Tabs. */
  simpleModeIntroHtml?: string;
}) {
  const { asset } = useAsset();
  const assetKey = asset as string;

  const stopGrid = STOP_GRIDS[assetKey] ?? STOP_GRIDS.nq;
  const tpGrid = TP_GRIDS[assetKey] ?? TP_GRIDS.nq;

  const trades = allTrades[assetKey] ?? [];

  // Profit factor of every stop×TP combo, so we can (1) land on the BEST combo
  // and (2) keep only the profitable ones in the grid — instead of dumping the
  // full "fullport" of mostly-losing combos. Profitable = PF ≥ 1 (makes money).
  const combos = useMemo(() => {
    const out: { x: number; y: number; pf: number }[] = [];
    for (const x of stopGrid) {
      for (const y of tpGrid) {
        const sub = trades.filter((t) => t.x_stop === x && t.y_tp === y);
        if (sub.length === 0) continue;
        out.push({ x, y, pf: computeKPI(sub).pf });
      }
    }
    return out;
  }, [trades, stopGrid, tpGrid]);

  const profitable = useMemo(() => combos.filter((c) => c.pf >= 1), [combos]);
  const bestCombo = useMemo(
    () => (combos.length ? combos.reduce((a, b) => (b.pf > a.pf ? b : a)) : null),
    [combos]
  );

  const filterBarOverride = useMemo(() => {
    // Keep only profitable stops/TPs; fall back to the full grid if nothing is
    // profitable (so the explorer is never empty).
    const useList = profitable.length > 0 ? profitable : combos.length > 0 ? combos : null;
    const stops = useList ? [...new Set(useList.map((c) => c.x))].sort((a, b) => a - b) : stopGrid;
    const tps = useList ? [...new Set(useList.map((c) => c.y))].sort((a, b) => a - b) : tpGrid;
    return {
      variantOptions: stops.map((v) => ({ key: formatNum(v), label: formatNum(v) })),
      tpOptions: tps.map((v) => ({ key: formatNum(v), label: formatNum(v) })),
      smtOptions: SIDE_OPTS,
      variantLabel: 'Stop',
      tpLabel: 'TP',
      smtLabel: 'Side',
      defaultVariant: formatNum(bestCombo?.x ?? stops[0]),
      defaultSmt: 'both',
      defaultTp: formatNum(bestCombo?.y ?? tps[0]),
    };
  }, [stopGrid, tpGrid, combos, profitable, bestCombo]);

  const initialBreakdown = useMemo(() => computeWeekdayBreakdown(trades), [trades]);

  const assetLabel = ASSET_LABEL[assetKey] ?? assetKey.toUpperCase();

  return (
    <>
      <h1 className="v3-sub-h1">
        <span className="v3-sub-ev">{eventFull(eventName.toLowerCase().replace(/\s+/g, '-'))}</span>
        {' · Straddle'}
      </h1>
      <p className="v3-sub-sub">
        {assetLabel} futures · {releaseTime ?? '8:30 ET'} release · {dateFrom}–{dateTo} backtest
        {trades.length > 0 ? ` · ${new Set(trades.map((t) => t.ts.slice(0, 10))).size} events` : ''}
      </p>
      <Suspense fallback={<div className="v3-tabs" style={{ height: 48 }} />}>
        <V3Tabs
          slug={slug}
          breakdown={initialBreakdown}
          trades={trades}
          tradesByVariant={null}
          tradesByVariantOff={null}
          statsByVariant={null}
          statsByVariantAndSmt={null}
          dateFrom={dateFrom}
          dateTo={dateTo}
          overviewContent={overviewContent}
          eventShort={eventName}
          asset={(assetKey as 'nq' | 'gc' | 'es' | 'si' | 'ym')}
          filterBarOverride={filterBarOverride}
          barsSlug={barsSlug}
          flat={true}
          simpleModeIntroHtml={simpleModeIntroHtml}
        />
      </Suspense>
    </>
  );
}
