'use client';

// Pieces a firm is drawn with on /prop-firms: its logo, a rule cell, a price, the promo
// clock, the arrow of an outbound button. The per-firm table of plans that lived here was
// replaced by the comparator on 01/11/2026 (Angelo: the firm window shows his words, its
// code and « See all plans », which opens the comparator on that firm).

import { Fragment, useEffect, useState } from 'react';
import { money } from './shared';
import type { Cell, FirmView } from './firm-view';

export const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export function FirmLogo({ firm, size }: { firm: Pick<FirmView, 'logo' | 'name'>; size: number }) {
  if (firm.logo) return <img className="firm-mark" src={firm.logo} alt="" width={size} height={size} loading="lazy" />;
  // No logo file for the firm: its initial, same footprint, so every card lines up.
  return (
    <span className="firm-mark firm-mark--letter" style={{ width: size, height: size, fontSize: Math.round(size / 2) }} aria-hidden="true">
      {firm.name.charAt(0)}
    </span>
  );
}

export function CellView({ cell }: { cell: Cell }) {
  if (cell.tag)
    return (
      <>
        {cell.text && <span className="ft-fig">{cell.text}</span>}
        <span className={`tag ${cell.tag.accent ? 'tag-trail' : 'tag-eod'}`} title={cell.tag.title || undefined}>
          {cell.tag.label}
        </span>
      </>
    );
  if (cell.muted) return <span className="none">{cell.text}</span>;
  // Figures read in mono, words ("Every 3 trading days") in the body face.
  return <span className={/^[\d$+\-–]/.test(cell.text) ? 'ft-fig' : 'ft-word'}>{cell.text}</span>;
}

export type ShownPrice = {
  now: number;
  was: number | null;
  alts: { now: number; was: number | null }[];
  per: string | null;
  from: boolean;
};

export function PriceView({ price }: { price: ShownPrice }) {
  return (
    <span className="ft-price">
      {price.from && <span className="price-from">from </span>}
      <span className="ft-now">{money(price.now)}</span>
      {price.per && <span className="per">{price.per}</span>}
      {price.was != null && (
        <s className="price-was">
          <span className="sr-only">normal price </span>
          {money(price.was)}
        </s>
      )}
      {price.alts.map((alt, i) => (
        <Fragment key={i}>
          <span className="price-sep" aria-hidden="true">/</span>
          <span className="ft-now">{money(alt.now)}</span>
          {alt.was != null && (
            <s className="price-was">
              <span className="sr-only">normal price </span>
              {money(alt.was)}
            </s>
          )}
        </Fragment>
      ))}
    </span>
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
