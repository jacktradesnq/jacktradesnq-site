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

const Check = () => (
  <svg className="ft-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Yes">
    <path d="M5 12.5l4.5 4.5L19 7" />
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
  // One row per account sold (program × size), every rule on the same line (Angelo,
  // 12/10/2026: « mettre dans la même ligne les prix, les size et les règles ensemble »).
  const rows = firm.columns.flatMap((c, i) =>
    firm.sizes.flatMap((r) => {
      const cell = r.cells[i];
      return cell ? [{ prog: c.name, i, size: r.size, cell }] : [];
    }),
  );
  const lineLabels = [
    ...new Set(rows.flatMap(({ cell }) => (cell.kind === 'price' ? cell.lines.map((l) => l.label) : []))),
  ];
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

      <p className="ft-swipe" aria-hidden="true">Swipe sideways for every rule →</p>
      <div className="ft-scroll" tabIndex={0} role="group" aria-label={`${firm.name} accounts, scrolls sideways`}>
        <table className="ft-table ft-flat">
          <thead>
            <tr>
              <th scope="col" className="ft-label ft-acc">Account</th>
              <th scope="col" className="ft-col ft-col--price">
                {firm.priceTitle}
                {firm.priceSub && <span className="ft-col-sub">{firm.priceSub}</span>}
              </th>
              {lineLabels.map((l) => (
                <th key={l} scope="col" className="ft-col ft-col--rule">{l}</th>
              ))}
              {firm.rules.map((r) => (
                <th key={r.label} scope="col" className="ft-col ft-col--rule">{r.label}</th>
              ))}
              {firm.common.map((t) => (
                <th key={t} scope="col" className="ft-col ft-col--rule">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ prog, i, size, cell }, k) => (
              <tr key={`${prog}-${size}`} className={k > 0 && rows[k - 1].i !== i ? 'ft-newprog' : undefined}>
                <th scope="row" className="ft-label ft-acc">
                  <span className="ft-acc-prog">{prog}</span>
                  <span className="ft-acc-size">{sizeLabel(size)}</span>
                </th>
                <td className="ft-cell">
                  <PriceView cell={cell.kind === 'price' ? { ...cell, lines: [] } : cell} />
                </td>
                {lineLabels.map((l) => {
                  const c = cell.kind === 'price' ? cell.lines.find((x) => x.label === l)?.cell : undefined;
                  return <td key={l} className="ft-cell">{c ? <CellView cell={c} /> : <span className="none">–</span>}</td>;
                })}
                {firm.rules.map((r) => (
                  <td key={r.label} className={r.cells[i].note ? 'ft-cell ft-cell--note' : 'ft-cell'}>
                    <CellView cell={r.cells[i]} />
                  </td>
                ))}
                {firm.common.map((t) => (
                  <td key={t} className="ft-cell">
                    <Check />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {firm.legend.length > 0 && (
        <footer className="ft-foot">
          <div className="legend">
            {firm.legend.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
