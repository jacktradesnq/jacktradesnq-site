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

  const filterBarOverride = useMemo(() => ({
    variantOptions: stopGrid.map((v) => ({ key: formatNum(v), label: formatNum(v) })),
    tpOptions: tpGrid.map((v) => ({ key: formatNum(v), label: formatNum(v) })),
    smtOptions: SIDE_OPTS,
    variantLabel: 'Stop',
    tpLabel: 'TP',
    smtLabel: 'Side',
    defaultVariant: formatNum(stopGrid[0]),
    defaultSmt: 'both',
    defaultTp: formatNum(tpGrid[0]),
  }), [stopGrid, tpGrid]);

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
