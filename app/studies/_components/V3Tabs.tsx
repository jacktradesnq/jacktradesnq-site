'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Fragment, Suspense, useState, useMemo, useEffect } from 'react';
import type { WeekdayBreakdown, WeekdayStats, YearBreakdown, TradeRow, StrategyStats, ProfitableCombo } from '@/lib/study-stats';
import { MIN_DISPLAY_PF } from '@/lib/study-display-config';
import { aggregateYearTotals } from '@/lib/year-stats-utils';
import { filterTradesByLookback, computeKPI, computeYearBreakdown, computeWeekdayBreakdown } from '@/lib/client-stats';
import FilterBar, { useFilterState } from './FilterBar';
import type { BestCombo, VariantKey as FilterVariantKey, SmtKey as FilterSmtKey } from './FilterBar';
import TradeMiniChart from './TradeMiniChart';
import WeekdayBars from './WeekdayBars';
import EquityCurve from './EquityCurve';
import DailyPnlBars from './DailyPnlBars';
import StraddleCylinders from './StraddleCylinders';
import ModeToggle from './ModeToggle';
import SimpleStatBand from './SimpleStatBand';
import StudyHero from './StudyHero';

type Tab = 'overview' | 'weekday' | 'year' | 'trades' | 'methodology';

type FilterBarOverride = {
  variantOptions?: Array<{ key: string; label: string }>;
  smtOptions?: Array<{ key: string; label: string }>;
  tpOptions?: Array<{ key: string; label: string }>;
  variantLabel?: string;
  smtLabel?: string;
  tpLabel?: string;
  defaultVariant?: string;
  defaultSmt?: string;
  defaultTp?: string;
};

const TAB_LIST: Array<{ key: Tab; label: string }> = [
  { key: 'overview',     label: 'Overview' },
  { key: 'weekday',      label: 'By weekday' },
  { key: 'year',         label: 'By year' },
  { key: 'trades',       label: 'Trade list' },
  { key: 'methodology',  label: 'Methodology' },
];

const LOOKBACK_LABELS: Record<string, string> = {
  '3mo': '3 months', '6mo': '6 months', '1y': '1 year', '5y': '5 years', 'all': 'all-time',
};

function WeekdayBlock({
  breakdown,
  slug,
  smtLabel = 'SMT-on',
  totalTradesCount = 0,
}: {
  breakdown: WeekdayBreakdown;
  slug: string;
  smtLabel?: string;
  totalTradesCount?: number;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const lookback = sp.get('lookback') || 'all';

  const days: Array<{ key: keyof WeekdayBreakdown; label: string }> = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
  ];

  const validDays = days.filter((d) => breakdown[d.key].n > 0);
  const bestDay = validDays.length
    ? validDays.reduce((a, b) => (breakdown[a.key].wr >= breakdown[b.key].wr ? a : b))
    : null;
  const losingDays = validDays.filter((d) => breakdown[d.key].net < 0);
  const worstDay = losingDays.length
    ? losingDays.reduce((a, b) => (breakdown[a.key].net <= breakdown[b.key].net ? a : b))
    : null;

  const maxWr = Math.max(...days.map((d) => breakdown[d.key].wr), 1);

  function barClass(st: WeekdayStats) {
    if (st.n === 0) return 'v3-wd-bar';
    if (st.net > 5) return 'v3-wd-bar pos';
    if (st.net < -5) return 'v3-wd-bar neg';
    return 'v3-wd-bar gold';
  }

  function pnlClass(st: WeekdayStats) {
    if (st.net > 0) return 'v3-wd-stat-pnl pos';
    if (st.net < 0) return 'v3-wd-stat-pnl neg';
    return 'v3-wd-stat-pnl zero';
  }

  const verdict = (() => {
    if (!bestDay) return 'Not enough data across weekdays to draw conclusions.';
    const bestSt = breakdown[bestDay.key];
    const parts: string[] = [
      `Best day: ${bestDay.label} (${bestSt.wr}% WR · ${bestSt.net >= 0 ? '+' : ''}${bestSt.net} pts net, N=${bestSt.n}).`,
    ];
    if (worstDay && worstDay.key !== bestDay.key) {
      const wSt = breakdown[worstDay.key];
      parts.push(`Worst: ${worstDay.label} (${wSt.wr}% WR · ${wSt.net} pts net).`);
    }
    return parts.join(' ');
  })();

  const hasData = validDays.length > 0;

  if (!hasData && totalTradesCount > 0) {
    const isLookbackLimit = lookback !== 'all';
    return (
      <div className="v3-coming-soon">
        {isLookbackLimit
          ? `No weekday data in the last ${LOOKBACK_LABELS[lookback] ?? lookback}.`
          : 'No weekday data for this filter combo.'}
        <br />
        <button type="button" className="v3-empty-cta" onClick={() => {
          const params = new URLSearchParams(sp.toString());
          if (isLookbackLimit) {
            params.set('lookback', 'all');
          } else {
            params.delete('variant'); params.delete('tp'); params.delete('smt'); params.delete('outcome');
          }
          router.replace(`/studies/${slug}/?${params.toString()}`, { scroll: false });
        }}>
          {isLookbackLimit ? `View all-time data (${totalTradesCount} trades)` : 'Reset filters'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <WeekdayBars breakdown={breakdown} title="Net PnL by weekday" subtitle={smtLabel} />
      <div className="v3-wd-h">Performance by day of the week</div>
      <div className="v3-wd-sub">Real data — {smtLabel} variant · tp1_be.</div>
      <div className="v3-wd-grid">
        {days.map((d) => {
          const st = breakdown[d.key];
          const isBest = bestDay?.key === d.key;
          const isWorst = worstDay?.key === d.key;
          const colClass = 'v3-wd-col' + (isBest ? ' best' : isWorst ? ' worst' : '');
          const barH = st.n === 0 ? 4 : Math.max(6, Math.round((st.wr / maxWr) * 80));
          return (
            <Link
              key={d.key}
              href={`/studies/${slug}/?tab=trades&day=${d.key}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className={colClass}>
                <div className="v3-wd-col-day">{d.label}</div>
                <div className="v3-wd-bar-wrap">
                  <div className={barClass(st)} style={{ height: `${barH}%` }} />
                </div>
                {st.n === 0 ? (
                  <>
                    <div className="v3-wd-stat">—</div>
                    <div className="v3-wd-stat-sub">N=0</div>
                    <div className="v3-wd-stat-pnl zero">no events</div>
                  </>
                ) : (
                  <>
                    <div className="v3-wd-stat">{st.wr}%</div>
                    <div className="v3-wd-stat-sub">N={st.n} · WR</div>
                    <div className={pnlClass(st)}>
                      {st.net >= 0 ? '+' : ''}{st.net} pts
                    </div>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="v3-wd-verdict">
        {bestDay ? (
          <>
            Best day: <strong>{bestDay.label}</strong>
            {' '}({breakdown[bestDay.key].wr}% WR · {breakdown[bestDay.key].net >= 0 ? '+' : ''}{breakdown[bestDay.key].net} pts net, N={breakdown[bestDay.key].n}).
            {worstDay && worstDay.key !== bestDay.key && ` Worst: ${worstDay.label} (${breakdown[worstDay.key].wr}% WR · ${breakdown[worstDay.key].net} pts net).`}
          </>
        ) : verdict}
      </div>
    </div>
  );
}

function YearBlock({ breakdown, slug, smtLabel = 'SMT-on', trades = [], onJumpToTrades, isStraddle = false, totalTradesCount = 0 }: { breakdown: YearBreakdown; slug: string; smtLabel?: string; trades?: TradeRow[]; onJumpToTrades?: (year: number) => void; isStraddle?: boolean; totalTradesCount?: number }) {
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

const VARIANT_LABELS: Record<string, string> = {
  tp1_be: 'TP1 + BE',
  be_50:  'TP only + BE',
  no_be:  'TP only',
};

function TradesBlock({
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

const COMBO_VARIANTS: FilterVariantKey[] = ['tp1_be', 'be_50', 'no_be'];
const COMBO_SMTS: FilterSmtKey[] = ['on', 'off'];
const COMBO_LOOKBACKS = ['6mo', '1y', 'all'] as const;
type ComboLookback = typeof COMBO_LOOKBACKS[number];

function computeBestCombo(
  tradesByVariant: { tp1_be: TradeRow[]; be_50: TradeRow[]; no_be: TradeRow[] } | null | undefined,
  tradesByVariantOff: { tp1_be: TradeRow[]; be_50: TradeRow[]; no_be: TradeRow[] } | null | undefined,
  minN = 10
): BestCombo | null {
  if (!tradesByVariant) return null;

  let best: BestCombo | null = null;

  for (const smt of COMBO_SMTS) {
    const poolTrades = smt === 'on' ? tradesByVariant : (tradesByVariantOff ?? tradesByVariant);
    if (!poolTrades) continue;
    for (const v of COMBO_VARIANTS) {
      const allTrades = (poolTrades as Record<string, TradeRow[]>)[v];
      for (const lookback of COMBO_LOOKBACKS) {
        const filtered = filterTradesByLookback(allTrades, lookback as ComboLookback);
        const kpi = computeKPI(filtered);
        if (kpi.n < minN) continue;
        if (best === null || kpi.pf > best.pf) {
          best = { variant: v, smt, lookback: lookback as ComboLookback, pf: kpi.pf };
        }
      }
    }
  }

  return best;
}

export default function V3Tabs({
  slug,
  breakdown,
  breakdownOff,
  trades: tradesProp,
  tradesByVariant,
  tradesByVariantOff,
  statsByVariant,
  statsByVariantAndSmt,
  dateFrom,
  dateTo,
  overviewContent,
  eventShort,
  asset,
  hideKpiBand = false,
  filterBarOverride,
  barsSlug,
  tradesUrl,
  flat = false,
  profitableCombos,
  simpleModeIntroHtml,
  simpleHideStatBand = false,
  showHero = false,
  heroMeta = '',
}: {
  slug: string;
  breakdown: WeekdayBreakdown;
  breakdownOff?: WeekdayBreakdown;
  trades: TradeRow[];
  tradesByVariant?: { tp1_be: TradeRow[]; be_50: TradeRow[]; no_be: TradeRow[] } | null;
  tradesByVariantOff?: { tp1_be: TradeRow[]; be_50: TradeRow[]; no_be: TradeRow[] } | null;
  statsByVariant?: { tp1_be: StrategyStats; be_50: StrategyStats; no_be: StrategyStats } | null;
  statsByVariantAndSmt?: {
    smtOn: { tp1_be: StrategyStats; be_50: StrategyStats; no_be: StrategyStats };
    smtOff: { tp1_be: StrategyStats; be_50: StrategyStats; no_be: StrategyStats };
  } | null;
  dateFrom?: string;
  dateTo?: string;
  overviewContent: React.ReactNode;
  eventShort: string;
  asset: 'nq' | 'gc' | 'es' | 'si' | 'ym';
  hideKpiBand?: boolean;
  filterBarOverride?: FilterBarOverride;
  barsSlug?: string;
  tradesUrl?: string;
  flat?: boolean;
  profitableCombos?: ProfitableCombo[];
  /** HTML string of the first paragraph — shown in Simple mode intro. */
  simpleModeIntroHtml?: string;
  /** Suppress the Simple-mode 4-stat band (when a richer hero already shows them). */
  simpleHideStatBand?: boolean;
  /** Render the data-viz hero card (gauge + numbers + win/loss bars) at the top. */
  showHero?: boolean;
  /** Eyebrow meta line for the hero (e.g. "Nasdaq 100 · 2016–2026 · 22 events"). */
  heroMeta?: string;
}) {
  // ── Lazy-fetch trades client-side when a URL is provided (avoids serializing
  //    large trade arrays into the static HTML payload) ──────────────────
  const [fetchedTrades, setFetchedTrades] = useState<TradeRow[] | null>(null);
  useEffect(() => {
    if (!tradesUrl) return;
    let active = true;
    fetch(tradesUrl)
      .then((r) => r.json())
      .then((d) => { if (active) setFetchedTrades((d.trades ?? d) as TradeRow[]); })
      .catch(() => { if (active) setFetchedTrades([]); });
    return () => { active = false; };
  }, [tradesUrl]);
  const trades: TradeRow[] = tradesUrl ? (fetchedTrades ?? []) : tradesProp;

  // ── Derive filtered options from profitableCombos (IFVG mode only) ──
  // profitableCombos = combos with lifetime PF >= MIN_DISPLAY_PF from server.
  // When present: restrict variant/smt options to survivors; best default = highest PF.
  const ifvgFilteredVariantOpts = useMemo(() => {
    if (!profitableCombos || profitableCombos.length === 0 || filterBarOverride) return undefined;
    const variants = new Set(profitableCombos.map((c) => c.variant));
    return [
      { key: 'tp1_be', label: 'TP1 + BE' },
      { key: 'be_50',  label: 'TP only + BE' },
      { key: 'no_be',  label: 'TP only' },
    ].filter((o) => variants.has(o.key as 'tp1_be' | 'be_50' | 'no_be'));
  }, [profitableCombos, filterBarOverride]);

  const ifvgFilteredSmtOpts = useMemo(() => {
    if (!profitableCombos || profitableCombos.length === 0 || filterBarOverride) return undefined;
    const smts = new Set(profitableCombos.map((c) => c.smt));
    return [
      { key: 'on',  label: 'SMT on' },
      { key: 'off', label: 'SMT off' },
    ].filter((o) => smts.has(o.key === 'on' ? true : false));
  }, [profitableCombos, filterBarOverride]);

  // Best default = surviving combo with highest PF
  const ifvgBestDefault = useMemo(() => {
    if (!profitableCombos || profitableCombos.length === 0 || filterBarOverride) return undefined;
    const best = profitableCombos.reduce((a, b) => (b.pf > a.pf ? b : a));
    return { variant: best.variant, smt: best.smt ? 'on' : 'off' };
  }, [profitableCombos, filterBarOverride]);

  // ── URL-driven filter state ──────────────────────────────────────────
  const fbo = filterBarOverride;
  const filterDefaults = fbo
    ? { defaultVariant: fbo.defaultVariant, defaultSmt: fbo.defaultSmt, defaultTp: fbo.defaultTp }
    : ifvgBestDefault
      ? { defaultVariant: ifvgBestDefault.variant, defaultSmt: ifvgBestDefault.smt }
      : undefined;
  const { variant, smtOn, lookback, tp: urlTp } = useFilterState(filterDefaults);
  const hasSmtToggle = fbo ? !!fbo.smtOptions : !!statsByVariantAndSmt;

  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') ?? 'overview') as Tab;
  const activeTab: Tab = TAB_LIST.some((t) => t.key === tab) ? tab : 'overview';
  const dayFilter = searchParams.get('day') ?? '';
  const yearFilter = searchParams.get('year') ?? '';

  // ── Jump-to-trades state (year click in By year tab) ─────────────────
  const [jumpYear, setJumpYear] = useState<number | null>(null);
  const [jumpTab, setJumpTab] = useState<Tab | null>(null);
  const [flatSec, setFlatSec] = useState<'weekday' | 'year' | 'trades'>('weekday');
  const [flatNotesOpen, setFlatNotesOpen] = useState(false);

  const resolvedTab: Tab = jumpTab ?? activeTab;
  const resolvedYearFilter: string = (jumpTab === 'trades' || flatSec === 'trades') && jumpYear !== null
    ? String(jumpYear)
    : yearFilter;

  // ── SMT label ────────────────────────────────────────────────────────
  const smtLabel = useMemo(() => {
    if (fbo?.smtOptions) {
      const smtParam = searchParams.get('smt') || fbo.defaultSmt || fbo.smtOptions[0]?.key || '';
      const opt = fbo.smtOptions.find((o) => o.key === smtParam);
      return opt ? opt.label : smtParam;
    }
    return smtOn ? 'SMT-on' : 'SMT-off';
  }, [fbo, smtOn, variant]);

  // ── Raw trade pool: IFVG uses variant sub-pools; straddle uses flat list ──
  const rawByVariant = useMemo(() => {
    if (fbo && !tradesByVariant) {
      // Straddle: filter by side (smt param = 'long'/'short'/'both')
      const sideFilter = smtOn ? variant : 'both'; // smtOn uses variant as side filter
      if (sideFilter === 'both') return undefined; // no variant sub-pools
      // Actually side filter is tracked via `smt` URL param in straddle mode
      return undefined;
    }
    return (!smtOn && tradesByVariantOff ? tradesByVariantOff : tradesByVariant) ?? undefined;
  }, [smtOn, tradesByVariant, tradesByVariantOff, fbo, variant]);

  // ── Apply lookback filter ─────────────────────────────────────────────
  const filteredByVariant = useMemo(() => {
    if (fbo && !tradesByVariant) return undefined;
    if (!rawByVariant) return undefined;
    return {
      tp1_be: filterTradesByLookback(rawByVariant.tp1_be, lookback),
      be_50:  filterTradesByLookback(rawByVariant.be_50,  lookback),
      no_be:  filterTradesByLookback(rawByVariant.no_be,  lookback),
    };
  }, [rawByVariant, lookback, fbo, tradesByVariant]);

  const activeTrades = useMemo(() => {
    const looked = filterTradesByLookback(trades, lookback);
    if (!fbo || !fbo.tpOptions) {
      // IFVG mode: use variant sub-pools
      return filteredByVariant ? filteredByVariant[variant as 'tp1_be' | 'be_50' | 'no_be'] : looked;
    }
    // Straddle mode: filter by stop (variant), tp (urlTp), side (smt param), outcome (outcome param)
    const stopVal = Number(variant);
    const tpVal = Number(urlTp);
    const sideParam = searchParams.get('smt') || fbo.defaultSmt || 'both';
    const outcomeParam = searchParams.get('outcome'); // 'win' | 'loss' | 'flat' | null
    return looked.filter((t) => {
      if (t.x_stop !== undefined && t.x_stop !== stopVal) return false;
      if (t.y_tp !== undefined && t.y_tp !== tpVal) return false;
      if (sideParam !== 'both' && t.side !== sideParam) return false;
      if (outcomeParam === 'win' && t.pnl_pts <= 0) return false;
      if (outcomeParam === 'loss' && t.pnl_pts >= 0) return false;
      if (outcomeParam === 'flat' && t.pnl_pts !== 0) return false;
      return true;
    });
  }, [filteredByVariant, variant, trades, lookback, fbo, tradesByVariant, urlTp, searchParams]);

  // ── KPI: recomputed client-side from filtered trades ──────────────────
  const kpi = useMemo(() => computeKPI(activeTrades), [activeTrades]);

  // Directional bias from the active trade set (Long / Short / Both).
  const heroBias = useMemo(() => {
    const longs = activeTrades.filter((t) => t.side.toLowerCase() === 'long');
    const shorts = activeTrades.filter((t) => t.side.toLowerCase() === 'short');
    const lwr = longs.length ? longs.filter((t) => t.pnl_pts > 0).length / longs.length : 0;
    const swr = shorts.length ? shorts.filter((t) => t.pnl_pts > 0).length / shorts.length : 0;
    return lwr > swr + 0.05 ? 'Long' : swr > lwr + 0.05 ? 'Short' : 'Both';
  }, [activeTrades]);

  // ── Breakdowns: recomputed from filtered trades ───────────────────────
  const activeYearBreakdown = useMemo(
    () => computeYearBreakdown(activeTrades),
    [activeTrades]
  );
  const activeBreakdown = useMemo(
    () => computeWeekdayBreakdown(activeTrades),
    [activeTrades]
  );

  function tabHref(t: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', t);
    params.delete('day');
    params.delete('year');
    return `/studies/${slug}/?${params.toString()}`;
  }

  const hasTradeData = fbo ? activeTrades.length > 0 : (tradesByVariant?.tp1_be?.length ?? 0) > 0;

  const heroNode = showHero && hasTradeData ? (
    <StudyHero
      title="Performance"
      meta={heroMeta}
      winRate={kpi.wr}
      pf={kpi.pf.toFixed(2)}
      net={`${kpi.net >= 0 ? '+' : ''}${kpi.net.toFixed(1)}`}
      netSub={`${asset.toUpperCase()} points · ${dateFrom}–${dateTo}`}
      bias={heroBias}
    />
  ) : null;

  // ── Best combo ───────────────
  const bestCombo = useMemo(
    () => {
      if (fbo || !tradesByVariant) return null;
      return hasTradeData ? computeBestCombo(tradesByVariant, tradesByVariantOff ?? undefined) : null;
    },
    [hasTradeData, tradesByVariant, tradesByVariantOff, fbo]
  );

  // ── Variant label for KPI foot ────────────────────────────────────────
  const kpiVariantLabel = useMemo(() => {
    if (fbo?.variantOptions) {
      const opt = fbo.variantOptions.find((o) => o.key === variant);
      return opt?.label ?? variant;
    }
    return (VARIANT_LABELS as Record<string, string>)[variant] ?? variant;
  }, [fbo, variant]);

  // ── Simple / Advanced mode ───────────────────────────────────────────
  const isSimpleMode = searchParams.get('mode') !== 'advanced';

  // Extract first paragraph of overview prose for Simple mode intro.
  // overviewContent is a React node; we render it hidden and grab HTML
  // only when overviewContent is a string — otherwise fall back to empty.
  // For server-rendered HTML strings passed as dangerouslySetInnerHTML
  // children, the parent page already converts md→HTML. We accept a
  // pre-extracted `simpleModeIntroHtml` prop (optional); if absent we
  // show a generic one-liner so Simple mode still works for all study types.
  const introHtml = simpleModeIntroHtml ?? '';

  if (isSimpleMode && hasTradeData) {
    return (
      <>
        {heroNode}
        <div className="v3-simple-adv-bar">
          <Suspense fallback={null}>
            <ModeToggle />
          </Suspense>
        </div>
        <SimpleStatBand
          wr={kpi.wr}
          pf={kpi.pf}
          n={kpi.n}
          net={kpi.net}
          dateFrom={dateFrom}
          dateTo={dateTo}
          lookback={lookback}
          introHtml={introHtml}
          hideStatBand={simpleHideStatBand}
        />
      </>
    );
  }

  // Advanced mode: render full experience + toggle to go back to Simple
  return (
    <>
      {heroNode}
      {/* ── Advanced mode toggle (top, above FilterBar) ── */}
      <div className="v3-simple-adv-bar">
        <Suspense fallback={null}>
          <ModeToggle />
        </Suspense>
      </div>

      {/* ── Sticky FilterBar ── */}
      {hasTradeData && (
        <div className="fb-sticky-wrap">
          <FilterBar
            hasSmtToggle={hasSmtToggle}
            bestCombo={bestCombo}
            variantOptions={fbo?.variantOptions ?? ifvgFilteredVariantOpts}
            smtOptions={fbo?.smtOptions ?? ifvgFilteredSmtOpts}
            tpOptions={fbo?.tpOptions}
            variantLabel={fbo?.variantLabel}
            smtLabel={fbo?.smtLabel}
            tpLabel={fbo?.tpLabel}
            defaultVariant={fbo?.defaultVariant ?? ifvgBestDefault?.variant}
            defaultSmt={fbo?.defaultSmt ?? ifvgBestDefault?.smt}
            defaultTp={fbo?.defaultTp}
          />
        </div>
      )}

      {/* ── KPI band ── */}
      {hasTradeData && !hideKpiBand && (
        <div className="v3-kpi-band fb-animated">
          <div className="v3-kpi-cell">
            <div className="v3-kpi-band-lbl">Profit factor</div>
            <div className={'v3-kpi-band-val' + (kpi.pf >= 1.5 ? ' pos' : '')}>
              {kpi.pf.toFixed(2)}
            </div>
            <div className="v3-kpi-band-foot">winners $ ÷ losers $</div>
          </div>
          <div className="v3-kpi-cell">
            <div className="v3-kpi-band-lbl">Sample size</div>
            <div className="v3-kpi-band-val">{kpi.n}</div>
            <div className="v3-kpi-band-foot">events tested</div>
          </div>
          <div className="v3-kpi-cell">
            <div className="v3-kpi-band-lbl">Net (pts)</div>
            <div className={'v3-kpi-band-val' + (kpi.net > 0 ? ' pos' : '')}>
              {kpi.net >= 0 ? '+' : ''}{kpi.net.toFixed(1)}
            </div>
            <div className="v3-kpi-band-foot">{lookback === 'all' ? `total over ${dateFrom}–${dateTo}` : `over the last ${LOOKBACK_LABELS[lookback] ?? lookback}`}</div>
          </div>
          <div className="v3-kpi-cell">
            <div className="v3-kpi-band-lbl">Win rate</div>
            <div className="v3-kpi-band-val gold">{kpi.wr}%</div>
            <div className="v3-kpi-band-foot">{kpiVariantLabel}{smtLabel ? ` · ${smtLabel}` : ''}</div>
          </div>
        </div>
      )}

      {/* ── Tabs nav ── */}
      {!flat && (
        <div className="v3-tabs">
          {TAB_LIST.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={'v3-tab' + (resolvedTab === t.key ? ' active' : '')}
              onClick={() => { setJumpTab(null); setJumpYear(null); }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* ── Flat switcher chips ── */}
      {flat && hasTradeData && (
        <div className="v3-flat-chips">
          <button type="button" className={'v3-flat-chip' + (flatSec === 'weekday' ? ' active' : '')} onClick={() => { setJumpYear(null); setFlatSec('weekday'); }}>Weekday</button>
          <button type="button" className={'v3-flat-chip' + (flatSec === 'year' ? ' active' : '')} onClick={() => { setJumpYear(null); setFlatSec('year'); }}>By year</button>
          <button type="button" className={'v3-flat-chip' + (flatSec === 'trades' ? ' active' : '')} onClick={() => { setJumpYear(null); setFlatSec('trades'); }}>Trades</button>
        </div>
      )}

      {/* ── Tab content ── */}
      {!flat ? (
        <div className="fb-animated">
          {resolvedTab === 'weekday' ? (
            <WeekdayBlock breakdown={activeBreakdown} slug={slug} smtLabel={smtLabel} totalTradesCount={trades.length} />
          ) : resolvedTab === 'year' ? (
            <YearBlock
              breakdown={activeYearBreakdown}
              slug={slug}
              smtLabel={smtLabel}
              trades={activeTrades}
              onJumpToTrades={(year) => { setJumpYear(year); setJumpTab('trades'); }}
              isStraddle={!!fbo}
              totalTradesCount={trades.length}
            />
          ) : resolvedTab === 'trades' ? (
            <TradesBlock
              trades={activeTrades}
              tradesByVariant={fbo ? undefined : filteredByVariant}
              variant={variant}
              setVariant={() => {}}
              dayFilter={dayFilter}
              yearFilter={resolvedYearFilter}
              onClearYearFilter={jumpYear !== null ? () => { setJumpYear(null); setJumpTab(null); } : undefined}
              slug={slug}
              eventShort={eventShort}
              asset={asset}
              smtLabel={smtLabel}
              barsSlug={barsSlug}
              filterLabel={fbo ? `${kpiVariantLabel} Stop · ${fbo.tpOptions?.find((o) => o.key === urlTp)?.label ?? urlTp} TP · ${fbo.smtOptions?.find((o) => o.key === searchParams.get('smt'))?.label ?? 'Both'}` : undefined}
              totalTradesCount={trades.length}
            />
          ) : resolvedTab === 'methodology' ? (
            <div className="v3-meth-link">
              <Link href="/studies/methodology/">Read full methodology →</Link>
              <p>Data sources, backtest engine, assumptions, what this is not.</p>
            </div>
          ) : (
            /* overview */
            <div className="v3-prose">{overviewContent}</div>
          )}
        </div>
      ) : (
        /* flat: compact single-view switcher (edgeful-style, no scroll) */
        <div className="fb-animated">
          {flatSec === 'year' ? (
            <YearBlock
              breakdown={activeYearBreakdown}
              slug={slug}
              smtLabel={smtLabel}
              trades={activeTrades}
              onJumpToTrades={(year) => { setJumpYear(year); setFlatSec('trades'); }}
              isStraddle={!!fbo}
              totalTradesCount={trades.length}
            />
          ) : flatSec === 'trades' ? (
            <TradesBlock
              trades={activeTrades}
              tradesByVariant={fbo ? undefined : filteredByVariant}
              variant={variant}
              setVariant={() => {}}
              dayFilter={dayFilter}
              yearFilter={resolvedYearFilter}
              onClearYearFilter={jumpYear !== null ? () => setJumpYear(null) : undefined}
              slug={slug}
              eventShort={eventShort}
              asset={asset}
              smtLabel={smtLabel}
              barsSlug={barsSlug}
              filterLabel={fbo ? `${kpiVariantLabel} Stop · ${fbo.tpOptions?.find((o) => o.key === urlTp)?.label ?? urlTp} TP · ${fbo.smtOptions?.find((o) => o.key === searchParams.get('smt'))?.label ?? 'Both'}` : undefined}
              totalTradesCount={trades.length}
            />
          ) : (
            <WeekdayBlock breakdown={activeBreakdown} slug={slug} smtLabel={smtLabel} totalTradesCount={trades.length} />
          )}

          {/* secondary: notes (collapsible) + methodology link — demoted, not in flow */}
          <div className="v3-flat-secondary">
            <button type="button" className="v3-flat-sec-link" onClick={() => setFlatNotesOpen((v) => !v)}>
              {flatNotesOpen ? 'Hide notes' : 'Notes'}
            </button>
            <Link href="/studies/methodology/" className="v3-flat-sec-link">Methodology →</Link>
          </div>
          {flatNotesOpen && <div className="v3-prose v3-flat-notes-body">{overviewContent}</div>}
        </div>
      )}
    </>
  );
}
