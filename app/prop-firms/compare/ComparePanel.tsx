'use client';

// « Prop compare »: every plan of every firm in one table, so a visitor finds a plan at his
// budget (Angelo, 01/11/2026). Rules, all his:
// - no ranking of any kind (partner contracts): A→Z by firm then size, no badge, no firm put
//   forward, the same columns for all; the visitor may sort a column himself;
// - PropFirmMatch's columns and filters (Size, Steps, Price, Apply discount, Customize),
//   futures and perps in two tables; plus Firm (one or more), Max loss type and Daily loss limit
//   in the same bar (Angelo, 01/11/2026);
// - no « Last checked » column (Angelo, 01/11/2026: « pas besoin de ça »);
// - only the site's own data; « — » when nothing is published, « None » when the firm says none;
// - on a phone, one card per plan and the filters fold away;
// - pick plans and compare them in this same table (Angelo, 02/11/2026: « tu prends 2 plan
//   différent que ce sois le même propfirm ou 2 propfirm différent ou même + et tu compares
//   comme ca, on rajoute rien [...] juste pouvoir selectionner ca »); no second click to
//   confirm (« t'as pas besoin de reconfirmer [...] ça s'ajoute, ça s'ajoute, mais tu peux faire
//   genre annuler »): a ticked plan joins the others at the top of the table, the list stays under.
// Self-contained: it can move to a page of its own by rendering <ComparePanel> there.

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { defaultOrder, filterRows, firmMatches, pickedFirst, sortBy, togglePick } from '@/lib/compare-order.mjs';
import { FirmSearch } from '../FirmSearch';
import { FAMILIES, shownPrice, type ComparePrice, type CompareRow, type Family, type Slider } from '../firm-view';
import { EXTRA_PROMO_ENDS, futuresRows } from '../futures';
import { perpsRows, usePromoLive } from '../perps';
import { usePromoClock } from '../promo-clock';
import { sizeLabel } from '../shared';
import { Arrow, CellView, FirmLogo, PriceView } from '../FirmTable';
import { COLUMNS, type Column } from './columns';

// A window narrower than this drops these columns (Angelo, 22/11/2026: « fit on one screen and adjust
// based on window sizing », a visitor on Discord); Customize lists them, ticking one brings it back.
const NARROW_PX = 1420; // measured 22/11/2026: 14 columns need 1287 px, the table zone is the window minus 130 px
const AUTO_HIDE = ['activation', 'steps'];
// Compact view, the default (Angelo, 22/11/2026: « largeur et quantité de chiffre »; a visitor: « it can get
// overwhelming with so much information all at once, if people want a detailed view you can give them that
// option as well »). Detailed shows every column; Customize still ticks any column in either view.
const COMPACT_IDS = ['firm', 'price', 'size', 'target', 'maxLoss', 'lossType', 'payoutFreq', 'dailyLoss', 'leverage']; // dailyLoss and leverage exist on the perps table only
type View = 'compact' | 'detailed';
import { COMPARE_CSS } from './compare-css';

// The comparator's own disclaimer, under the table (Angelo, 01/11/2026: firms showing code JTNQ
// are affiliates; a firm without code JTNQ is not). « or JackTNQ »: Tradeify's code since
// 19/11/2026 (content/prop-firms/codes.md).
export const COMPARE_NOTE =
  'Firms shown with code JTNQ or JackTNQ are affiliates: JackTradesNQ earns a commission on sign-ups made with code JTNQ or JackTNQ. A firm shown without code JTNQ or JackTNQ is not an affiliate.';

const LONG = 48;

type Dir = 'asc' | 'desc';
type DailyLossFilter = 'with' | 'without' | null;
type Sort = { col: string; dir: Dir } | null;

function PriceCell({ price, discount }: { price: ComparePrice; discount: boolean }) {
  const p = shownPrice(price, discount);
  if (price.kind === 'text' || !p) return <span className="none">{price.kind === 'text' ? price.text : '—'}</span>;
  return <PriceView price={{ ...p, per: price.per, from: price.from }} />;
}

// Options: the row's Daily loss buttons, when the plan is sold with several limits; and the stop of
// each of its sliders, when the plan is picked with sliders (CompareRow.sliders).
type Options = {
  chosen: (row: CompareRow) => number;
  choose: (row: CompareRow, i: number) => void;
  stops: (row: CompareRow) => number[];
  move: (row: CompareRow, slider: number, stop: number) => void;
};

// One rule of a plan sold in many combinations, picked like on the firm's configurator (Vest 1-Step,
// Angelo 28/11/2026: « tu clique tu drag gauche droite »): click or drag, one stop per value, arrow
// keys; the value picked above, the lowest and highest under the ends.
function SliderCell({
  row,
  slider,
  stop,
  onMove,
  titled = false,
}: {
  row: CompareRow;
  slider: Slider;
  stop: number;
  onMove: (stop: number) => void;
  titled?: boolean;
}) {
  const last = slider.values.length - 1;
  const at = (i: number) => (last > 0 ? (i / last) * 100 : 0);
  return (
    <span className="cmp-slide" style={{ '--pos': `${at(stop)}%` } as CSSProperties}>
      {titled && <span className="cmp-slide-title">{slider.label}</span>}
      <span className="cmp-slide-val">
        <span className="ft-fig">{slider.values[stop]}</span>
        {slider.subs && <span className="cmp-sub">{slider.subs[stop]}</span>}
      </span>
      <span className="cmp-slide-track">
        <span className="cmp-slide-rail" aria-hidden="true">
          {slider.values.map((v, i) => (
            <span key={v} className={`cmp-slide-stop${i <= stop ? ' on' : ''}`} style={{ left: `${at(i)}%` }} />
          ))}
        </span>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={stop}
          aria-label={`${slider.label}, ${row.firmName} ${row.program} ${sizeLabel(row.size)}`}
          aria-valuetext={slider.values[stop]}
          onChange={(e) => onMove(Number(e.target.value))}
        />
      </span>
      <span className="cmp-slide-ends" aria-hidden="true">
        <span>{slider.values[0]}</span>
        <span>{slider.values[last]}</span>
      </span>
    </span>
  );
}

// A slider whose column the view hides (Profit split is not in the Compact view, Angelo 22/11/2026) goes
// under the price, with its name: the price shown always matches a slider the visitor can see (Vest
// 1-Step and E8 One, Angelo 28/11/2026 : « quand y a bcp de choix possible »).
function OffViewSliders({ row, shown, options }: { row: CompareRow; shown: string[]; options: Options }) {
  const off = (row.sliders ?? []).flatMap((s, si) => (shown.includes(s.col) ? [] : [{ s, si }]));
  if (!off.length) return null;
  return (
    <span className="cmp-slide-under">
      {off.map(({ s, si }) => (
        <SliderCell key={s.col} row={row} slider={s} stop={options.stops(row)[si]} onMove={(stop) => options.move(row, si, stop)} titled />
      ))}
    </span>
  );
}

// The value of `col` when it follows a slider of the row (E8 One's target and daily loss follow its
// drawdown): the value at that slider's stop.
function linkedVal(row: CompareRow, col: string, stops: number[]) {
  for (const [i, s] of (row.sliders ?? []).entries()) {
    const link = s.links?.find((l) => l.col === col);
    if (link) return link.values[stops[i]];
  }
  return undefined;
}

function ValCell({ row, col, options }: { row: CompareRow; col: string; options: Options }) {
  const si = row.sliders?.findIndex((s) => s.col === col) ?? -1;
  if (row.sliders && si >= 0)
    return <SliderCell row={row} slider={row.sliders[si]} stop={options.stops(row)[si]} onMove={(stop) => options.move(row, si, stop)} />;
  const linked = row.sliders ? linkedVal(row, col, options.stops(row)) : undefined;
  if (col === 'dailyLoss' && row.options)
    return (
      <span className="cmp-opts" role="group" aria-label={`Daily loss limit, ${row.firmName} ${row.program} ${sizeLabel(row.size)}`}>
        {row.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            className="cmp-opt"
            aria-pressed={i === options.chosen(row)}
            onClick={() => options.choose(row, i)}
          >
            {o.label}
          </button>
        ))}
      </span>
    );
  const v = linked ?? row.cells[col];
  if (!v)
    return (
      <span className="none cmp-dash">
        <span aria-hidden="true">—</span>
        <span className="sr-only">not published</span>
      </span>
    );
  // A long sentence (a payout cap per size) is cut to three lines in the table, whole on hover
  // and on a phone.
  const long = v.text.length > LONG;
  return (
    <span className={`cmp-val${long ? ' cmp-long' : ''}`} title={v.title ?? (long ? v.text : undefined)}>
      <CellView cell={v} />
      {v.sub && <span className="cmp-sub">{v.sub}</span>}
    </span>
  );
}

function Go({ row }: { row: CompareRow }) {
  return (
    <a
      className="row-cta"
      href={row.href}
      target="_blank"
      rel={row.affiliate ? 'noopener nofollow sponsored' : 'noopener nofollow'}
      aria-label={`Get funded at ${row.firmName}, ${row.program} ${sizeLabel(row.size)}`}
    >
      Get funded
      <Arrow />
    </a>
  );
}

// The firm's own words on the plan (paid options, hours), folded so every row keeps its height.
function Note({ row }: { row: CompareRow }) {
  return row.note ? (
    <details className="cmp-note-d">
      <summary>Note</summary>
      <p>{row.note}</p>
    </details>
  ) : null;
}

function Code({ row }: { row: CompareRow }) {
  return row.code ? (
    <span className="promo-chip" title={row.code.title}>
      code {row.code.code}
    </span>
  ) : null;
}

function Pick({ row, picked, onToggle }: { row: CompareRow; picked: CompareRow[]; onToggle: (row: CompareRow) => void }) {
  return (
    <label className="cmp-pick">
      <input
        type="checkbox"
        checked={picked.some((p) => p.key === row.key)}
        aria-label={`Compare ${row.firmName}, ${row.program} ${sizeLabel(row.size)}`}
        onChange={() => onToggle(row)}
      />
      Compare
    </label>
  );
}

function SortMark({ dir }: { dir: Dir | null }) {
  return (
    <svg className={`cmp-sort-mark${dir ? ' on' : ''}`} viewBox="0 0 12 16" aria-hidden="true">
      <path d="M6 2l4 5H2z" opacity={dir === 'desc' ? 0.25 : 1} />
      <path d="M6 14l4-5H2z" opacity={dir === 'asc' ? 0.25 : 1} />
    </svg>
  );
}

export function ComparePanel({ firm, onFirmChange }: { firm: string | null; onFirmChange: (id: string | null) => void }) {
  const uid = useId();
  const promoLive = usePromoLive();
  const futuresAt = usePromoClock(EXTRA_PROMO_ENDS);
  const rowsBy = useMemo<Record<Family, CompareRow[]>>(
    () => ({ futures: defaultOrder(futuresRows(futuresAt)), perps: defaultOrder(perpsRows(promoLive)) }),
    [futuresAt, promoLive],
  );
  // #compare=<firm-id>: the firm's own table opens; an unknown id shows every firm.
  const firmFamily = (['futures', 'perps'] as const).find((f) => rowsBy[f].some((r) => r.firmId === firm)) ?? null;
  const firmId = firmFamily ? firm : null;

  const [family, setFamily] = useState<Family>(firmFamily ?? 'futures');
  // The Firm filter: one or more firms, none = every firm. One firm picked is #compare=<firm-id>.
  const [firms, setFirms] = useState<string[]>(firmId ? [firmId] : []);
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [steps, setSteps] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState('');
  const [lossType, setLossType] = useState<string | null>(null);
  const [dailyLoss, setDailyLoss] = useState<DailyLossFilter>(null);
  const [discount, setDiscount] = useState(true);
  const [hidden, setHidden] = useState<Record<Family, string[]>>({ futures: [], perps: [] });
  // Window under NARROW_PX: the columns of AUTO_HIDE leave the table (it fits one screen); ticking one
  // in Customize brings it back (forced).
  const [view, setView] = useState<View>('compact');
  const [narrow, setNarrow] = useState(false);
  const [forced, setForced] = useState<Record<Family, string[]>>({ futures: [], perps: [] });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_PX - 1}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [sort, setSort] = useState<Sort>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The plans ticked: at the top of the table whatever the filters, so plans of any size or firm
  // can be added one after the other.
  const [pickedKeys, setPickedKeys] = useState<string[]>([]);
  const countRef = useRef<HTMLParagraphElement>(null);
  // The Daily loss button picked on each plan sold with several limits; none = its first version.
  const [optionOf, setOptionOf] = useState<Record<string, number>>({});
  // The slider stops picked on each plan picked with sliders; none = the firm's defaults.
  const [stopsOf, setStopsOf] = useState<Record<string, number[]>>({});
  const startStops = (r: CompareRow) => r.sliders?.map((s) => s.start) ?? [];
  const options: Options = {
    chosen: (r) => optionOf[r.key] ?? 0,
    choose: (r, i) => setOptionOf((prev) => ({ ...prev, [r.key]: i })),
    stops: (r) => stopsOf[r.key] ?? startStops(r),
    move: (r, slider, stop) =>
      setStopsOf((prev) => {
        const next = [...(prev[r.key] ?? startStops(r))];
        next[slider] = stop;
        return { ...prev, [r.key]: next };
      }),
  };
  // The price of the row as picked: its sliders' combination, or its Daily loss button.
  const priceNow = (r: CompareRow) =>
    (r.combos && r.combos[options.stops(r).join('|')]) ?? r.options?.[options.chosen(r)]?.price ?? r.price;

  // The firm id this panel last put in the address itself (Firm filter), so its echo back
  // through `firm` is not taken for a firm picked from its window.
  const sent = useRef<string | null>(firmId);
  // A firm picked from its window (« See all plans », #compare=<firm-id>): its family's table,
  // filters that could hide it cleared. The address back to #compare (chip ×, a new tab) clears
  // a single firm; several firms picked in the filter stay.
  useEffect(() => {
    const own = firmId === sent.current;
    sent.current = firmId;
    if (own) return;
    if (firmId) {
      setFirms([firmId]);
      if (firmFamily) setFamily(firmFamily);
      setQuery('');
      setSize(null);
      setSteps(null);
      setLossType(null);
      setDailyLoss(null);
    } else setFirms((prev) => (prev.length === 1 ? [] : prev));
  }, [firmId, firmFamily]);

  function pickFirms(next: string[]) {
    setFirms(next);
    const id = next.length === 1 ? next[0] : null;
    if (id !== firmId) {
      sent.current = id;
      onFirmChange(id);
    }
  }

  function pickFamily(f: Family) {
    if (f === family) return;
    setFamily(f);
    setSize(null);
    setSteps(null);
    setLossType(null);
    setSort(null);
    setPickedKeys([]);
    if (firms.length) pickFirms([]);
  }

  // A firm that is only in the other table: that table opens, the search stays.
  function search(next: string) {
    setQuery(next);
    const other: Family = family === 'futures' ? 'perps' : 'futures';
    const has = (f: Family) => rowsBy[f].some((r) => firmMatches(r.firmName, next));
    if (!has(family) && has(other)) pickFamily(other);
  }

  const all = rowsBy[family];
  const picked = all.filter((r) => pickedKeys.includes(r.key));

  // A plan added goes to the top of the table, and the page with it (the browser follows the row
  // anyway when it moves: this makes it the same on every click).
  function togglePlan(row: CompareRow) {
    const next = togglePick(picked, row);
    setPickedKeys(next.map((r) => r.key));
    if (next.length > picked.length) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => countRef.current?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: still ? 'auto' : 'smooth' }));
    }
  }

  // Firms of this family, A→Z (the rows already are).
  const firmList = [...new Map(all.map((r) => [r.firmId, r.firmName])).entries()].map(([id, name]) => ({ id, name }));
  const firmRows = firms.length ? all.filter((r) => firms.includes(r.firmId)) : all;
  // A column no plan of this family has a value for is left out (columns.ts).
  const available = COLUMNS[family].filter((c) => c.fixed || all.some((r) => r.cells[c.id] != null));
  const offByDefault = (id: string) => (view === 'compact' && !COMPACT_IDS.includes(id)) || (narrow && AUTO_HIDE.includes(id));
  const autoHidden = (id: string) => offByDefault(id) && !forced[family].includes(id);
  const cols = available.filter((c) => !hidden[family].includes(c.id) && !autoHidden(c.id));
  const colIds = cols.map((c) => c.id);
  const toggleColumn = (id: string, on: boolean) => {
    const auto = offByDefault(id);
    setHidden((h) => ({ ...h, [family]: on ? h[family].filter((x) => x !== id) : auto ? h[family] : [...new Set([...h[family], id])] }));
    if (auto) setForced((f) => ({ ...f, [family]: on ? [...new Set([...f[family], id])] : f[family].filter((x) => x !== id) }));
  };
  const sizes = [...new Set(firmRows.map((r) => r.size))].sort((a, b) => a - b);
  const stepsList = [...new Set(firmRows.map((r) => r.steps))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  // Max loss types as the column writes them, whatever the firms picked (a type no plan of
  // this family has is not offered).
  const lossTypes = [...new Set(all.map((r) => r.lossType).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'en'));

  const budget = maxPrice.trim() === '' ? null : Number(maxPrice);
  const priceOf = (r: CompareRow) => shownPrice(priceNow(r), discount)?.now ?? null;
  const filtered = filterRows(
    all,
    { firmIds: firms, firmQuery: query, size, steps, lossType, dailyLoss, maxPrice: budget != null && Number.isFinite(budget) ? budget : null },
    priceOf,
  );
  // A column with a slider, or that follows one, sorts by the value picked.
  const sliderSort = (r: CompareRow, col: string) => {
    if (!r.sliders) return undefined;
    const i = r.sliders.findIndex((s) => s.col === col);
    if (i >= 0) return r.sliders[i].sorts[options.stops(r)[i]] ?? null;
    return linkedVal(r, col, options.stops(r))?.sort;
  };
  const keyOf = (col: string) => (r: CompareRow) =>
    col === 'price' ? priceOf(r) : col === 'firm' ? `${r.firmName} ${r.program}` : sliderSort(r, col) ?? r.cells[col]?.sort ?? null;
  const ordered = (rows: CompareRow[]) => (sort ? sortBy(rows, keyOf(sort.col), sort.dir) : rows);
  const shown = pickedFirst(ordered(picked), ordered(filtered));
  const lastPicked = picked.length < shown.length ? picked.length - 1 : -1;

  // A click on a header sorts A→Z / low→high, a second click the other way, a third goes
  // back to the default order.
  function toggleSort(col: string) {
    setSort((s) => (s?.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null));
  }
  const dirOf = (col: string): Dir | null => (sort?.col === col ? sort.dir : null);

  function clearFilters() {
    setQuery('');
    setSize(null);
    setSteps(null);
    setMaxPrice('');
    setLossType(null);
    setDailyLoss(null);
    pickFirms([]);
  }

  const firmName = firms.length === 1 ? firmList.find((f) => f.id === firms[0])?.name ?? null : null;
  const firmSummary = firms.length === 0 ? 'All firms' : firmName ?? `${firms.length} firms`;
  const familyLabel = FAMILIES.find((f) => f.id === family)?.label ?? family;
  const detailCols = cols.filter((c) => c.id !== 'firm' && c.id !== 'price' && c.id !== 'size');

  const head = (c: Column) => (
    <th
      key={c.id}
      scope="col"
      className={`cmp-th${c.align === 'left' ? ' cmp-left' : ''}${c.id === 'firm' ? ' cmp-firm-col' : ''}`}
      aria-sort={dirOf(c.id) === 'asc' ? 'ascending' : dirOf(c.id) === 'desc' ? 'descending' : undefined}
    >
      <button type="button" className="cmp-sort" onClick={() => toggleSort(c.id)}>
        <span>{c.label}</span>
        <SortMark dir={dirOf(c.id)} />
      </button>
    </th>
  );

  return (
    <div className={`cmp cmp-view-${view} cmp-fam-${family}`}>
      <style>{COMPARE_CSS}</style>

      <div className="cmp-top">
        <div className="ft-seg cmp-fam" role="group" aria-label="Market">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={family === f.id}
              className={`ft-prog${family === f.id ? ' active' : ''}`}
              onClick={() => {
                if (f.id !== family) setQuery('');
                pickFamily(f.id);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <FirmSearch value={query} onChange={search} names={[...rowsBy.futures, ...rowsBy.perps].map((r) => r.firmName)} />
        {firmName && (
          <span className="cmp-firm-chip">
            <span className="cmp-firm-chip-k">Firm</span>
            {firmName}
            <button type="button" className="cmp-firm-chip-x" aria-label="Show every firm" onClick={() => pickFirms([])}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        )}
        <button
          type="button"
          className="cmp-filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls={`${uid}-filters`}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className={`cmp-filters${filtersOpen ? ' open' : ''}`} id={`${uid}-filters`}>
        <div className="cmp-field" role="group" aria-labelledby={`${uid}-firm-k`}>
          <span className="cmp-field-k" id={`${uid}-firm-k`}>
            Firm
          </span>
          <details className="cmp-multi">
            <summary className="cmp-multi-sum">
              <span>{firmSummary}</span>
            </summary>
            <fieldset className="cmp-custom-list cmp-multi-list">
              <legend className="sr-only">Firms shown</legend>
              {firmList.map((f) => (
                <label key={f.id} className="cmp-check">
                  <input
                    type="checkbox"
                    checked={firms.includes(f.id)}
                    onChange={(e) =>
                      pickFirms(e.target.checked ? firmList.map((x) => x.id).filter((id) => id === f.id || firms.includes(id)) : firms.filter((x) => x !== f.id))
                    }
                  />
                  {f.name}
                </label>
              ))}
            </fieldset>
          </details>
        </div>
        <label className="cmp-field">
          <span className="cmp-field-k">Size</span>
          <span className="cmp-select">
            <select value={size ?? ''} onChange={(e) => setSize(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All sizes</option>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {sizeLabel(s)}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="cmp-field">
          <span className="cmp-field-k">Steps</span>
          <span className="cmp-select">
            <select value={steps ?? ''} onChange={(e) => setSteps(e.target.value || null)}>
              <option value="">All</option>
              {stepsList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="cmp-field">
          <span className="cmp-field-k">Max price</span>
          <span className="cmp-money">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </span>
        </label>
        <label className="cmp-field">
          <span className="cmp-field-k">Max loss type</span>
          <span className="cmp-select">
            <select value={lossType ?? ''} onChange={(e) => setLossType(e.target.value || null)}>
              <option value="">All</option>
              {lossTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="cmp-field">
          <span className="cmp-field-k">Daily loss limit</span>
          <span className="cmp-select">
            <select value={dailyLoss ?? ''} onChange={(e) => setDailyLoss((e.target.value || null) as DailyLossFilter)}>
              <option value="">Any</option>
              <option value="with">With</option>
              <option value="without">Without</option>
            </select>
          </span>
        </label>
        <label className="cmp-field cmp-sort-m">
          <span className="cmp-field-k">Sort by</span>
          <span className="cmp-select">
            <select
              value={sort ? `${sort.col}:${sort.dir}` : ''}
              onChange={(e) => {
                const [col, dir] = e.target.value.split(':');
                setSort(col ? { col, dir: dir as Dir } : null);
              }}
            >
              <option value="">Firm A–Z, then size</option>
              {cols.map((c) => (
                <optgroup key={c.id} label={c.label}>
                  <option value={`${c.id}:asc`}>{c.label} ↑</option>
                  <option value={`${c.id}:desc`}>{c.label} ↓</option>
                </optgroup>
              ))}
            </select>
          </span>
        </label>
        <button type="button" role="switch" aria-checked={discount} className="cmp-switch" onClick={() => setDiscount((d) => !d)}>
          <span className="cmp-switch-track" aria-hidden="true">
            <span className="cmp-switch-knob" />
          </span>
          Apply discount
        </button>
        <span className="cmp-opts cmp-view" role="group" aria-label="Table view">
          {(['compact', 'detailed'] as const).map((v) => (
            <button key={v} type="button" className="cmp-opt" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'compact' ? 'Compact' : 'Detailed'}
            </button>
          ))}
        </span>
        <details className="cmp-custom">
          <summary>Customize</summary>
          <fieldset className="cmp-custom-list">
            <legend className="sr-only">Columns shown</legend>
            {available
              .filter((c) => !c.fixed)
              .map((c) => (
                <label key={c.id} className="cmp-check">
                  <input
                    type="checkbox"
                    checked={!hidden[family].includes(c.id) && !autoHidden(c.id)}
                    onChange={(e) => toggleColumn(c.id, e.target.checked)}
                  />
                  {c.label}
                </label>
              ))}
          </fieldset>
        </details>
      </div>

      <p className="cmp-count" aria-live="polite" ref={countRef}>
        {shown.length} {familyLabel.toLowerCase()} plan{shown.length === 1 ? '' : 's'}
      </p>

      {shown.length === 0 ? (
        <div className="cmp-empty">
          <p>No plan matches these filters.</p>
          <button type="button" className="ft-prog" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="cmp-scroll" tabIndex={0} role="region" aria-label={`${familyLabel} plans, scrolls sideways`}>
            <table className="cmp-table">
              <caption className="sr-only">
                {familyLabel} prop firm plans{firmName ? ` at ${firmName}` : ''}. Column headers sort the table.
              </caption>
              <thead>
                <tr>
                  {cols.map(head)}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={r.key} className={i === lastPicked ? 'cmp-picked-last' : undefined}>
                    {cols.map((c) =>
                      c.id === 'firm' ? (
                        <th key={c.id} scope="row" className="cmp-firm cmp-left cmp-firm-col">
                          <span className="cmp-firm-in">
                            <FirmLogo firm={{ name: r.firmName, logo: r.logo }} size={28} />
                            <span className="cmp-firm-txt">
                              <span className="cmp-firm-name">{r.firmName}</span>
                              <span className="cmp-prog">{r.program}</span>
                              <span className="cmp-firm-meta">
                                <Code row={r} />
                                <Note row={r} />
                                <Pick row={r} picked={picked} onToggle={togglePlan} />
                              </span>
                            </span>
                          </span>
                        </th>
                      ) : (
                        <td key={c.id} className={`cmp-td cmp-c-${c.id}`}>
                          {c.id === 'price' ? (
                            <span className="cmp-price-go">
                              <PriceCell price={priceNow(r)} discount={discount} />
                              <OffViewSliders row={r} shown={colIds} options={options} />
                              <Go row={r} />
                            </span>
                          ) : (
                            <ValCell row={r} col={c.id} options={options} />
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="cmp-cards" aria-label={`${familyLabel} plans`}>
            {shown.map((r, i) => (
              <li key={r.key} className={`cmp-card${i === lastPicked ? ' cmp-picked-last' : ''}`}>
                <div className="cmp-card-head">
                  <FirmLogo firm={{ name: r.firmName, logo: r.logo }} size={32} />
                  <span className="cmp-firm-txt">
                    <span className="cmp-firm-name">{r.firmName}</span>
                    <span className="cmp-prog">{r.program}</span>
                  </span>
                  <span className="cmp-card-size">{sizeLabel(r.size)}</span>
                </div>
                <div className="cmp-card-price">
                  <PriceCell price={priceNow(r)} discount={discount} />
                  <OffViewSliders row={r} shown={detailCols.map((c) => c.id)} options={options} />
                </div>
                <dl className="cmp-card-dl">
                  {detailCols.map((c) => (
                    <div key={c.id} className="cmp-card-row">
                      <dt>{c.label}</dt>
                      <dd>
                        <ValCell row={r} col={c.id} options={options} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <Note row={r} />
                <div className="cmp-card-foot">
                  <Pick row={r} picked={picked} onToggle={togglePlan} />
                  <Code row={r} />
                  <Go row={r} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {picked.length > 0 && (
        <div className="cmp-tray" role="status">
          <span className="cmp-tray-txt">
            {picked.length} plan{picked.length === 1 ? '' : 's'} selected
          </span>
          <button type="button" className="fw-all" onClick={() => setPickedKeys([])}>
            Cancel
          </button>
        </div>
      )}

      <p className="cmp-note">{COMPARE_NOTE}</p>
    </div>
  );
}
