'use client';

// Perpetuals prop firms, in their own block under the futures table. Rules are
// percentages of the starting balance, so they do not fit the futures columns
// (dollar targets, contracts) — hence a separate table.
//
// The JTNQ promo has a hard end (endsAt). Three moments to get right:
// - build: a build made after endsAt never shows the promo (BUILD_TS, inlined
//   by next.config.js), so the daily rebuild drops it on its own;
// - before hydration: the static HTML shows the state of the build, with a
//   placeholder clock of the same width as the real one (no layout jump);
// - in the browser: the clock ticks every second and, once endsAt passes, the
//   block falls back to normal prices only.

import { useEffect, useState } from 'react';
import rawData from '@/public/data/perps-firms.json';
import { money, sizeLabel } from './shared';
import { goHref } from '@/lib/go-links';

type PerpsPlan = { size: number; price: number | null; promoPrice: number | null; note?: string };
type PerpsProgram = {
  name: string;
  profitTarget: string;
  maxDrawdown: string;
  dailyLoss: string | null;
  split: string;
  payouts: string;
  ddAfterFirstPayout: string;
  leverage: string;
  plans: PerpsPlan[];
};
type PerpsFirm = {
  id: string;
  name: string;
  url: string;
  lastChecked: string;
  markets: string[];
  common: string;
  promo: { code: string; discountPct: number; endsAt: string; lastChecked: string } | null;
  programs: PerpsProgram[];
};

const DATA = rawData as unknown as { generatedAt: string; firms: PerpsFirm[] };
const BUILD_TS = Number(process.env.NEXT_PUBLIC_BUILD_TS ?? 0);

const pad = (n: number) => String(n).padStart(2, '0');
function clock(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
}

const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

function useNow(endsMs: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (endsMs == null || Date.now() >= endsMs) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsMs) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsMs]);
  return now;
}

export function PerpsBlock() {
  return (
    <>
      <style>{PERPS_CSS}</style>
      {DATA.firms.map((firm) => (
        <PerpsFirmBlock key={firm.id} firm={firm} />
      ))}
    </>
  );
}

function PerpsFirmBlock({ firm }: { firm: PerpsFirm }) {
  const endsMs = firm.promo ? Date.parse(firm.promo.endsAt) : null;
  const liveAtBuild = endsMs != null && BUILD_TS < endsMs;
  const now = useNow(liveAtBuild ? endsMs : null);
  const promoOn = liveAtBuild && (now == null || now < (endsMs as number));
  const promo = promoOn ? firm.promo : null;

  const sizes = [...new Set(firm.programs.flatMap((p) => p.plans.map((pl) => pl.size)))].sort((a, b) => a - b);
  const endsLabel = firm.promo
    ? new Date(firm.promo.endsAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      })
    : '';

  return (
    <section className="perps-section" aria-labelledby={`perps-${firm.id}`}>
      <div className="perps-head">
        <div className="perps-id">
          <div className="perps-eyebrow">Perpetuals prop firm</div>
          <h2 id={`perps-${firm.id}`} className="perps-title">
            {firm.name}
            <span className="dot">.</span>
          </h2>
          <p className="perps-markets">{firm.markets.join(' · ')}</p>
          <p className="perps-common">{firm.common}</p>
        </div>
        <a className="row-cta perps-cta" href={goHref('prop-firms', firm.id)} target="_blank" rel="noopener nofollow sponsored">
          Get funded
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>

      {promo && (
        <p className="perps-promo">
          <span className="promo-chip">code {promo.code}</span>
          <span className="perps-promo-text">
            {promo.discountPct}% off with code {promo.code} — ends in{' '}
            <span className="perps-clock" role="timer" aria-live="off">
              {now == null ? '--h --m --s' : clock((endsMs as number) - now)}
            </span>
          </span>
        </p>
      )}

      <div className="table-wrap">
        <table className="perps-table">
          <thead>
            <tr>
              <th className="col-firm"><span className="h">Program</span></th>
              <th><span className="h">Target</span></th>
              <th><span className="h">Max loss</span></th>
              <th><span className="h">Daily loss</span></th>
              <th><span className="h">Payouts</span></th>
              {sizes.map((s) => (
                <th key={s} className="col-size"><span className="h">{sizeLabel(s)}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firm.programs.map((program) => (
              <tr key={program.name} className="perps-row">
                <td className="col-firm">
                  <span className="firm-row-name">{program.name}</span>
                  <span className="perps-meta">
                    {program.split} split · max loss after 1st payout: {program.ddAfterFirstPayout.toLowerCase()} · leverage: {program.leverage.toLowerCase()}
                  </span>
                </td>
                <td className="num" data-label="Target">{program.profitTarget}</td>
                <td className="num" data-label="Max loss">
                  {program.maxDrawdown} <span className="perps-static">static</span>
                </td>
                <td className="num" data-label="Daily loss">{program.dailyLoss ?? <span className="none">None</span>}</td>
                <td className="perps-payouts" data-label="Payouts">{program.payouts}</td>
                {sizes.map((s) => {
                  const plan = program.plans.find((pl) => pl.size === s);
                  if (!plan) return <td key={s} className="num col-size perps-empty"><span className="none">—</span></td>;
                  if (plan.price == null)
                    return <td key={s} className="num col-size" data-label={sizeLabel(s)}><span className="none">{plan.note ?? '—'}</span></td>;
                  return (
                    <td key={s} className="num col-size" data-label={sizeLabel(s)}>
                      <span className="price-line">
                        {promo && plan.promoPrice != null ? (
                          <>
                            {money(plan.promoPrice)}
                            <s className="price-was">{money(plan.price)}</s>
                          </>
                        ) : (
                          money(plan.price)
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Target, max loss and daily loss are percentages of the starting balance.
        {promo
          ? ` Crossed-out prices are the normal prices; code ${promo.code} takes ${promo.discountPct}% off until ${endsLabel} New York time.`
          : ''}{' '}
        Prices checked {humanDate(firm.promo?.lastChecked ?? firm.lastChecked)}; the live checkout price wins.
      </p>
    </section>
  );
}

const PERPS_CSS = `
.jtnq-cmp .perps-section{
  max-width: var(--maxw); margin: 0 auto; padding: 0 var(--pad-x) clamp(72px, 9vw, 104px);
}
.jtnq-cmp .perps-head{
  display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
  gap: 16px 24px; margin-bottom: 24px; padding-top: clamp(32px, 4vw, 48px);
  border-top: 1px solid var(--c-line-soft);
}
.jtnq-cmp .perps-id{ min-width: 0; max-width: 64ch; }
.jtnq-cmp .perps-eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-cmp .perps-title{
  margin: 12px 0 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(32px, 4vw, 48px); line-height: 1.05; letter-spacing: -0.015em; color: var(--c-text);
}
.jtnq-cmp .perps-title .dot{ color: var(--c-accent); }
.jtnq-cmp .perps-markets{
  margin: 12px 0 0; font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-soft);
}
.jtnq-cmp .perps-common{ margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: var(--c-text-mute); text-wrap: pretty; }
.jtnq-cmp .perps-cta{ flex-shrink: 0; }
.jtnq-cmp .perps-promo{
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0 0 16px;
  padding: 12px 16px; border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); border-radius: 12px;
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 6%);
}
.jtnq-cmp .perps-promo .promo-chip{ cursor: default; }
.jtnq-cmp .perps-promo-text{ font-size: 14px; color: var(--c-text); }
.jtnq-cmp .perps-clock{
  font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-weight: 500; color: var(--c-accent);
  white-space: nowrap;
}
.jtnq-cmp .perps-table{ min-width: 880px; }
.jtnq-cmp .perps-table .col-firm{ width: 220px; min-width: 200px; }
.jtnq-cmp .perps-table td.col-firm{ white-space: normal; }
.jtnq-cmp .perps-table .firm-row-name{ display: block; }
.jtnq-cmp .perps-meta{
  display: block; margin-top: 4px; font-family: var(--f-mono); font-size: 10px; letter-spacing: .08em;
  text-transform: uppercase; line-height: 1.5; color: var(--c-text-mute);
}
.jtnq-cmp .perps-table td.num{ font-size: clamp(14px, 1.3vw, 16px); }
.jtnq-cmp .perps-static{ margin-left: 4px; font-size: 10px; font-weight: 400; letter-spacing: .1em; text-transform: uppercase; color: var(--c-text-mute); }
.jtnq-cmp .perps-payouts{ font-size: 14px; color: var(--c-text-soft); white-space: nowrap; }
.jtnq-cmp .perps-table .col-size .price-line{ flex-direction: column; align-items: flex-start; gap: 2px; }
@media (max-width: 720px){
  .jtnq-cmp .perps-head{ align-items: stretch; }
  .jtnq-cmp .perps-cta{ width: 100%; justify-content: center; }
  .jtnq-cmp .perps-table{ min-width: 0; }
  .jtnq-cmp tr.perps-row{
    display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; row-gap: 16px;
    background: var(--c-bg-raise); border: 1px solid var(--c-line); border-radius: 12px;
    padding: 16px; margin-bottom: 12px;
  }
  .jtnq-cmp tr.perps-row td{ padding: 0; }
  .jtnq-cmp .perps-table td.col-firm{ grid-area: auto; grid-column: 1 / -1; width: auto; min-width: 0; position: static; background: none; }
  .jtnq-cmp .perps-table td.perps-empty{ display: none; }
  .jtnq-cmp .perps-table .col-size .price-line{ flex-direction: row; align-items: baseline; gap: 8px; }
}
`;
