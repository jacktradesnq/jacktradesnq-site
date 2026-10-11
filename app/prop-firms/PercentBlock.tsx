'use client';

// One block for the non-futures families under the futures table on /prop-firms:
// CFD (CfdBlock) and Perps (PerpsBlock). Angelo, 11/10/2026: « faut que tu mettes
// perps comme truc, du coup on aura futures, CFD et perps » — both read the same:
// eyebrow, big title with the gold dot, one intro line, size pills, one row per
// program. Each family turns its own JSON into PercentRow[]; this file only draws.

import { useMemo, useState, type ReactNode } from 'react';
import { money, sizeLabel } from './shared';

export type PercentRow = {
  key: string;
  logo: string | null;
  firmName: string;
  program: string;
  meta: string[];
  note: string | null;
  chip: { code: string; title: string } | null;
  price: number;
  was: number | null;
  priceNotes: string[];
  profitTarget: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  dailyLoss: string | null;
  href: string;
};

// A firm can publish "None" for a limit (no daily loss on Tradeify FX Daily): that is a
// rule, not a missing figure, so it reads "None"; null means not published, "n/c".
function limitCell(value: string | null) {
  if (value == null) return <span className="none">n/c</span>;
  if (value === 'None') return <span className="none">None</span>;
  return value;
}

export function PercentBlock({
  id,
  eyebrow,
  title,
  intro,
  sizeAria,
  sizes,
  defaultSize,
  rowsFor,
  commonRules,
  banner,
  legendFirst,
  note,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  sizeAria: string;
  sizes: number[];
  defaultSize: number;
  rowsFor: (size: number) => PercentRow[];
  commonRules?: { label: string; items: string[] };
  banner?: ReactNode;
  legendFirst: string;
  note: string;
}) {
  const [size, setSize] = useState(sizes.includes(defaultSize) ? defaultSize : sizes[0]);
  const rows = useMemo(() => rowsFor(size).sort((a, b) => a.price - b.price), [rowsFor, size]);

  return (
    <section className="table-section cfd-section" aria-labelledby={`${id}-title`}>
      <header className="cfd-head">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="cfd-title" id={`${id}-title`}>
          {title}
          <span className="dot">.</span>
        </h2>
        <p className="cfd-intro">{intro}</p>
      </header>

      {commonRules && (
        <div className="common-rules">
          <span className="common-rules-label">{commonRules.label}</span>
          <ul className="common-rules-list">
            {commonRules.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {banner}

      <div className="controls">
        <div className="size-pills" role="group" aria-label={sizeAria}>
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              className={`pill ${s === size ? 'active' : ''}`}
              aria-pressed={s === size}
              onClick={() => setSize(s)}
            >
              {sizeLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="cfd-table">
          <thead>
            <tr>
              <th className="col-firm"><span className="h">Program</span></th>
              <th><span className="h">Price</span></th>
              <th><span className="h">Profit target</span></th>
              <th><span className="h">Max loss limit</span></th>
              <th><span className="h">Daily loss</span></th>
              <th className="col-cta" aria-label="Sign-up link" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="firm-row">
                <td className="col-firm" data-label="Program">
                  <span className="firm-row-id cfd-row-id">
                    {row.logo && (
                      <img className="firm-logo" src={row.logo} alt="" width={22} height={22} loading="lazy" />
                    )}
                    <span className="cfd-firm-label">{row.firmName}</span>
                    <span className="firm-row-name">{row.program}</span>
                    <span className="firm-row-meta">
                      {/* each fact stays on one line: "1:100 FX" must not break after the ratio */}
                      {row.meta.map((t) => t.replace(/ /g, ' ')).join(' · ')}
                    </span>
                    {row.note && <span className="cfd-note">{row.note}</span>}
                    {row.chip && (
                      <span className="promo-chip" title={row.chip.title}>
                        code {row.chip.code}
                      </span>
                    )}
                  </span>
                </td>
                <td className="num cell-price" data-label="Price">
                  <span className="price-line">
                    {money(row.price)}
                    {row.was != null && <s className="price-was">{money(row.was)}</s>}
                  </span>
                  {row.priceNotes.map((t) => (
                    <span key={t} className="activation-note">{t}</span>
                  ))}
                </td>
                <td className="num cell-target" data-label="Profit target">
                  {row.profitTarget ?? <span className="none">None</span>}
                </td>
                <td className="num cell-loss" data-label="Max loss limit">
                  {row.maxDrawdown ? (
                    <>
                      {row.maxDrawdown} {row.ddType && <span className="dd-tag">{row.ddType}</span>}
                    </>
                  ) : (
                    <span className="none">n/c</span>
                  )}
                </td>
                <td className="num cell-daily" data-label="Daily loss">
                  {limitCell(row.dailyLoss)}
                </td>
                <td className="col-cta">
                  <a className="row-cta" href={row.href} target="_blank" rel="noopener nofollow sponsored">
                    Get funded
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <p>{legendFirst}</p>
        <p>Static — the loss limit never moves · Trailing — it follows your closed balance up to your starting balance, then stops</p>
        {rows.some((r) => !r.maxDrawdown || r.dailyLoss == null) && (
          <p>n/c — the firm does not publish that limit per program</p>
        )}
      </div>
      <p className="note">{note}</p>
    </section>
  );
}
