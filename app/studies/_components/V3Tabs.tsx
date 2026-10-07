'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useMemo, useEffect } from 'react';
import type { WeekdayBreakdown, TradeRow, StrategyStats, ProfitableCombo } from '@/lib/strategy-stats';
import { filterTradesByLookback, computeKPI, computeYearBreakdown, computeWeekdayBreakdown } from '@/lib/client-stats';
import FilterBar, { useFilterState } from './FilterBar';
import type { BestCombo, VariantKey as FilterVariantKey, SmtKey as FilterSmtKey } from './FilterBar';
import WeekdayBars from './WeekdayBars';
import ModeToggle from './ModeToggle';
import SimpleStatBand from './SimpleStatBand';
import StudyHero from './StudyHero';
import { LOOKBACK_LABELS } from '@/lib/lookback-labels';
import { WeekdayBlock } from './V3WeekdayTab';
import { YearBlock } from './V3YearTab';
import { TradesBlock, VARIANT_LABELS } from './V3TradesTab';

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
        {!simpleHideStatBand && (['mon', 'tue', 'wed', 'thu', 'fri'] as const).some((k) => (breakdown[k]?.n ?? 0) > 0) ? (
          <WeekdayBars breakdown={breakdown} title="Net PnL by weekday" subtitle={kpiVariantLabel} />
        ) : null}
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
