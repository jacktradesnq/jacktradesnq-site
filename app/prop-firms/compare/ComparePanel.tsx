'use client';

// « Prop compare »: every plan of every firm in one table, so a visitor finds a plan at his
// budget (Angelo, 01/11/2026). Rules, all his:
// - no ranking of any kind (partner contracts): A→Z by firm then size, no badge, no firm put
//   forward, the same columns for all; the visitor may sort a column himself;
// - PropFirmMatch's columns and filters (Size, Steps, Price, Apply discount, Customize),
//   futures and perps in two tables;
// - each row says when its firm was last checked;
// - only the site's own data; « — » when nothing is published, « None » when the firm says none;
// - on a phone, one card per plan and the filters fold away.
// Self-contained: it can move to a page of its own by rendering <ComparePanel> there.

import { useEffect, useId, useMemo, useState } from 'react';
import { defaultOrder, filterRows, sortBy } from '@/lib/compare-order.mjs';
import { FAMILIES, shownPrice, type CompareRow, type Family } from '../firm-view';
import { EXTRA_PROMO_ENDS, futuresRows } from '../futures';
import { perpsRows, usePromoLive } from '../perps';
import { usePromoClock } from '../promo-clock';
import { sizeLabel } from '../shared';
import { Arrow, CellView, FirmLogo, PriceView } from '../FirmTable';
import { COLUMNS, type Column } from './columns';
import { COMPARE_CSS } from './compare-css';

// The comparator's own disclaimer, under the table (Angelo, 01/11/2026: firms showing code JTNQ
// are affiliates; a firm without code JTNQ is not).
export const COMPARE_NOTE =
  'Firms shown with code JTNQ are affiliates: JackTradesNQ earns a commission on sign-ups made with code JTNQ. A firm shown without code JTNQ is not an affiliate.';

const LONG = 48;

type Dir = 'asc' | 'desc';
type Sort = { col: string; dir: Dir } | null;

function PriceCell({ row, discount }: { row: CompareRow; discount: boolean }) {
  const p = shownPrice(row.price, discount);
  if (row.price.kind === 'text' || !p) return <span className="none">{row.price.kind === 'text' ? row.price.text : '—'}</span>;
  return <PriceView price={{ ...p, per: row.price.per, from: row.price.from }} />;
}

function ValCell({ row, col }: { row: CompareRow; col: string }) {
  const v = row.cells[col];
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
  const [size, setSize] = useState<number | null>(null);
  const [steps, setSteps] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState('');
  const [discount, setDiscount] = useState(true);
  const [hidden, setHidden] = useState<Record<Family, string[]>>({ futures: [], perps: [] });
  const [sort, setSort] = useState<Sort>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // A firm picked from its window: its family's table, filters that could hide it cleared.
  useEffect(() => {
    if (firmFamily) setFamily(firmFamily);
    setSize(null);
    setSteps(null);
  }, [firmId, firmFamily]);

  function pickFamily(f: Family) {
    if (f === family) return;
    setFamily(f);
    setSize(null);
    setSteps(null);
    setSort(null);
    if (firmId && firmFamily !== f) onFirmChange(null);
  }

  const all = rowsBy[family];
  const firmRows = firmId ? all.filter((r) => r.firmId === firmId) : all;
  // A column no plan of this family has a value for is left out (columns.ts).
  const available = COLUMNS[family].filter((c) => c.fixed || all.some((r) => r.cells[c.id] != null));
  const cols = available.filter((c) => !hidden[family].includes(c.id));
  const sizes = [...new Set(firmRows.map((r) => r.size))].sort((a, b) => a - b);
  const stepsList = [...new Set(firmRows.map((r) => r.steps))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const budget = maxPrice.trim() === '' ? null : Number(maxPrice);
  const priceOf = (r: CompareRow) => shownPrice(r.price, discount)?.now ?? null;
  const filtered = filterRows(all, { firmId, size, steps, maxPrice: budget != null && Number.isFinite(budget) ? budget : null }, priceOf);
  const keyOf = (col: string) => (r: CompareRow) =>
    col === 'price' ? priceOf(r) : col === 'firm' ? `${r.firmName} ${r.program}` : r.cells[col]?.sort ?? null;
  const shown = sort ? sortBy(filtered, keyOf(sort.col), sort.dir) : filtered;

  // A click on a header sorts A→Z / low→high, a second click the other way, a third goes
  // back to the default order.
  function toggleSort(col: string) {
    setSort((s) => (s?.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null));
  }
  const dirOf = (col: string): Dir | null => (sort?.col === col ? sort.dir : null);

  function clearFilters() {
    setSize(null);
    setSteps(null);
    setMaxPrice('');
    onFirmChange(null);
  }

  const firmName = firmId ? all.find((r) => r.firmId === firmId)?.firmName : null;
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
    <div className="cmp">
      <style>{COMPARE_CSS}</style>

      <div className="cmp-top">
        <div className="ft-seg cmp-fam" role="group" aria-label="Market">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={family === f.id}
              className={`ft-prog${family === f.id ? ' active' : ''}`}
              onClick={() => pickFamily(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {firmName && (
          <span className="cmp-firm-chip">
            <span className="cmp-firm-chip-k">Firm</span>
            {firmName}
            <button type="button" className="cmp-firm-chip-x" aria-label="Show every firm" onClick={() => onFirmChange(null)}>
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
                    checked={!hidden[family].includes(c.id)}
                    onChange={(e) =>
                      setHidden((h) => ({
                        ...h,
                        [family]: e.target.checked ? h[family].filter((x) => x !== c.id) : [...h[family], c.id],
                      }))
                    }
                  />
                  {c.label}
                </label>
              ))}
          </fieldset>
        </details>
      </div>

      <p className="cmp-count" aria-live="polite">
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
                  <th scope="col" className="cmp-th">
                    <span className="sr-only">Link</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key}>
                    {cols.map((c) =>
                      c.id === 'firm' ? (
                        <th key={c.id} scope="row" className="cmp-firm cmp-left cmp-firm-col">
                          <span className="cmp-firm-in">
                            <FirmLogo firm={{ name: r.firmName, logo: r.logo }} size={28} />
                            <span className="cmp-firm-txt">
                              <span className="cmp-firm-name">{r.firmName}</span>
                              <span className="cmp-prog">{r.program}</span>
                              {(r.code || r.note) && (
                                <span className="cmp-firm-meta">
                                  <Code row={r} />
                                  <Note row={r} />
                                </span>
                              )}
                            </span>
                          </span>
                        </th>
                      ) : (
                        <td key={c.id} className={`cmp-td cmp-c-${c.id}`}>
                          {c.id === 'price' ? <PriceCell row={r} discount={discount} /> : <ValCell row={r} col={c.id} />}
                        </td>
                      ),
                    )}
                    <td className="cmp-td cmp-go">
                      <Go row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="cmp-cards" aria-label={`${familyLabel} plans`}>
            {shown.map((r) => (
              <li key={r.key} className="cmp-card">
                <div className="cmp-card-head">
                  <FirmLogo firm={{ name: r.firmName, logo: r.logo }} size={32} />
                  <span className="cmp-firm-txt">
                    <span className="cmp-firm-name">{r.firmName}</span>
                    <span className="cmp-prog">{r.program}</span>
                  </span>
                  <span className="cmp-card-size">{sizeLabel(r.size)}</span>
                </div>
                <div className="cmp-card-price">
                  <PriceCell row={r} discount={discount} />
                </div>
                <dl className="cmp-card-dl">
                  {detailCols.map((c) => (
                    <div key={c.id} className="cmp-card-row">
                      <dt>{c.label}</dt>
                      <dd>
                        <ValCell row={r} col={c.id} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <Note row={r} />
                <div className="cmp-card-foot">
                  <Code row={r} />
                  <Go row={r} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="cmp-note">{COMPARE_NOTE}</p>
    </div>
  );
}
