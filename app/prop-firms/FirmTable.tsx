'use client';

// The full table of one firm, opened under its card on /prop-firms: rules shared by every
// plan, one column per program, one row per rule, one row per account size for prices.
// Everything at once, no size or program filter (Angelo, 11/10/2026: « ils n'ont pas
// besoin de faire 25K, 50K, 100K »).

import { useEffect, useState } from 'react';
import { money, sizeLabel } from './shared';
import type { Cell, FirmView, PriceCell } from './firm-view';

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export function FirmLogo({ firm, size }: { firm: Pick<FirmView, 'logo' | 'name'>; size: number }) {
  if (firm.logo) return <img className="firm-mark" src={firm.logo} alt="" width={size} height={size} loading="lazy" />;
  // No logo file for the firm: its initial, same footprint, so every card lines up.
  return (
    <span className="firm-mark firm-mark--letter" style={{ width: size, height: size }} aria-hidden="true">
      {firm.name.charAt(0)}
    </span>
  );
}

function CellView({ cell }: { cell: Cell }) {
  if (cell.tag)
    return (
      <>
        {cell.text && <span className="ft-fig">{cell.text}</span>}
        <span className={`tag ${cell.tag.accent ? 'tag-trail' : 'tag-eod'}`} title={cell.tag.title}>
          {cell.tag.label}
        </span>
      </>
    );
  if (cell.note) return <span className="ft-sentence">{cell.text}</span>;
  if (cell.muted) return <span className="none">{cell.text}</span>;
  // Figures read in mono, words ("Locks at start balance", "Daily") in the body face.
  return (
    <span className={/^[\d$+\-–]/.test(cell.text) ? 'ft-fig' : 'ft-word'}>
      {cell.text}
      {cell.soft && (
        <span className="soft-flag" title="Soft breach: position flattened, account not lost">
          soft
        </span>
      )}
    </span>
  );
}

function PriceView({ cell }: { cell: PriceCell }) {
  if (cell == null) return <span className="none" aria-label="Not offered">–</span>;
  if (cell.kind === 'text') return <span className="none">{cell.text}</span>;
  return (
    <>
      <span className="ft-price">
        {cell.from && <span className="price-from">from </span>}
        <span className="ft-now">{money(cell.now)}</span>
        {cell.per && <span className="per">{cell.per}</span>}
        {cell.was != null && (
          <s className="price-was">
            <span className="sr-only">normal price </span>
            {money(cell.was)}
          </s>
        )}
        {cell.alt && (
          <>
            <span className="price-sep" aria-hidden="true">/</span>
            <span className="ft-now">{money(cell.alt.now)}</span>
            {cell.alt.was != null && (
              <s className="price-was">
                <span className="sr-only">normal price </span>
                {money(cell.alt.was)}
              </s>
            )}
          </>
        )}
      </span>
      {cell.lines.length > 0 && (
        <span className="ft-lines">
          {cell.lines.map(({ label, cell: c }) => (
            <span key={label} className="ft-line">
              <span className="ft-line-k">{label}</span> <CellView cell={c} />
            </span>
          ))}
        </span>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
function clock(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
}

// Ticks on its own so the rest of the page does not re-render every second. Before
// hydration it prints a placeholder of the same width as the real clock.
export function PromoClock({ endsMs }: { endsMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (Date.now() >= endsMs) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsMs) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsMs]);
  return (
    <span className="perps-clock" role="timer" aria-live="off">
      {now == null ? '--h --m --s' : clock(endsMs - now)}
    </span>
  );
}

export function FirmTable({ firm, id, banner }: { firm: FirmView; id: string; banner?: React.ReactNode }) {
  const cols = firm.columns.length;
  return (
    <div className="ft" id={id} role="region" aria-label={`${firm.name} plans`}>
      <header className="ft-head">
        <div className="ft-id">
          <FirmLogo firm={firm} size={36} />
          <div>
            <h3 className="ft-title">{firm.name}</h3>
            <p className="ft-sub">
              {cols} program{cols > 1 ? 's' : ''} · every size{firm.summary ? ` · ${firm.summary}` : ''}
            </p>
          </div>
        </div>
        <div className="ft-actions">
          {firm.code && (
            <span className="promo-chip" title={firm.code.title}>
              code {firm.code.code}
            </span>
          )}
          {firm.stale && (
            <span className="stale-chip" title={firm.stale.title}>
              {firm.stale.label}
            </span>
          )}
          <a className="row-cta" href={firm.href} target="_blank" rel="noopener nofollow sponsored">
            Get funded
            <Arrow />
          </a>
        </div>
      </header>

      {banner}

      {firm.common.length > 0 && (
        <section className="ft-common" aria-label="Same on every plan">
          <h4 className="ft-k">Same on every plan</h4>
          <ul>
            {firm.common.map((t) => (
              <li key={t}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cols > 1 && <p className="ft-swipe" aria-hidden="true">Swipe sideways for every program →</p>}
      <div className="ft-scroll" tabIndex={0} role="group" aria-label={`${firm.name} plan table, scrolls sideways`}>
        <table className="ft-table" style={{ ['--cols' as string]: cols }}>
          <thead>
            <tr>
              <th className="ft-label" scope="col">
                <span className="sr-only">Rule</span>
              </th>
              {firm.columns.map((c) => (
                <th key={c.name} scope="col" className="ft-col">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firm.rules.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="ft-label">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className={c.note ? 'ft-cell ft-cell--note' : 'ft-cell'}>
                    <CellView cell={c} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="ft-sec">
              <th scope="colgroup" colSpan={cols + 1} className="ft-sec-cell">
                <span className="ft-sec-title">{firm.priceTitle}</span>
                {firm.priceSub && <span className="ft-sec-sub">{firm.priceSub}</span>}
              </th>
            </tr>
            {firm.sizes.map((row) => (
              <tr key={row.size}>
                <th scope="row" className="ft-label ft-size">
                  {sizeLabel(row.size)}
                </th>
                {row.cells.map((c, i) => (
                  <td key={i} className="ft-cell">
                    <PriceView cell={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="ft-foot">
        {firm.legend.length > 0 && (
          <div className="legend">
            {firm.legend.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        )}
        <p className="note">{firm.note}</p>
      </footer>
    </div>
  );
}
