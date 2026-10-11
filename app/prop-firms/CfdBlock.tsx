'use client';

import { useMemo, useState } from 'react';
import rawCfdData from '@/public/data/cfd-firms.json';
import { META, money, sizeLabel } from './shared';
import { goHref } from '@/lib/go-links';

// CFD block under the futures table on /prop-firms (Angelo, 11/10/2026: « Le tableau
// futures reste tel quel, j'ajoute en dessous un bloc CFD avec Tradeify FX, son lien et
// JTNQ »). Same row layout as the CFD comparator retired on 27/09 (254f83e): CFD firms
// publish their limits as a percentage of the balance, so the cells are strings.

type CfdPlan = { size: number; price: number };
type CfdProgram = {
  name: string;
  market: 'cfd';
  steps: string;
  profitTarget: string | null;
  dailyLoss: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  minDays: string | null;
  split: string;
  leverage: string;
  note: string;
  plans: CfdPlan[];
};
// Firm-wide discount applied by the affiliate link itself (checked on the firm's checkout).
type CfdDiscount = {
  code: string;
  discountPct: number;
  appliedByLink: boolean;
  endsAt: string | null;
  lastChecked: string;
};
type CfdFirm = {
  id: string;
  name: string;
  logo: string | null;
  payout: string;
  promo: { label: string; code: string } | null;
  discount?: CfdDiscount;
  url: string;
  lastChecked: string;
  stale: boolean;
  programs: CfdProgram[];
};
type CfdData = { generatedAt: string; firms: CfdFirm[] };

const DATA = rawCfdData as unknown as CfdData;

const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const NOTE = `List prices and rules read on each firm's own site and help center on ${humanDate(DATA.generatedAt)}, not auto-synced. Discounted prices are the list price minus the firm's discount, checked on its checkout on ${humanDate(DATA.firms.find((f) => f.discount)?.discount?.lastChecked ?? DATA.generatedAt)}. Promos change fast; the live checkout price wins.`;

// Same arithmetic as the firm's checkout: list price x (100 - pct) / 100, to the cent.
// price * (100 - pct) is an integer, so the division by 100 is exact to the cent.
const discounted = (price: number, pct: number) => Math.round(price * (100 - pct)) / 100;
const finalPrice = (firm: CfdFirm, plan: CfdPlan) =>
  firm.discount ? discounted(plan.price, firm.discount.discountPct) : plan.price;

const DEFAULT_SIZE = 25000;

// A firm can publish "None" for a limit (no daily loss on Tradeify FX Daily): that is a
// rule, not a missing figure, so it reads "None"; null means not published, "n/c".
function limitCell(value: string | null) {
  if (value == null) return <span className="none">n/c</span>;
  if (value === 'None') return <span className="none">None</span>;
  return value;
}

export function CfdBlock() {
  const sizes = useMemo(() => {
    const all = new Set<number>();
    for (const firm of DATA.firms)
      for (const program of firm.programs) for (const plan of program.plans) all.add(plan.size);
    return [...all].sort((a, b) => a - b);
  }, []);
  const [size, setSize] = useState(sizes.includes(DEFAULT_SIZE) ? DEFAULT_SIZE : sizes[0]);

  const rows = useMemo(() => {
    const out: { firm: CfdFirm; program: CfdProgram; plan: CfdPlan }[] = [];
    for (const firm of DATA.firms)
      for (const program of firm.programs) {
        const plan = program.plans.find((p) => p.size === size);
        if (plan) out.push({ firm, program, plan });
      }
    return out.sort((a, b) => finalPrice(a.firm, a.plan) - finalPrice(b.firm, b.plan));
  }, [size]);

  if (DATA.firms.length === 0) return null;

  return (
    <section className="table-section cfd-section" aria-labelledby="cfd-title">
      <header className="cfd-head">
        <div className="eyebrow">{META.heroCfd.eyebrow}</div>
        <h2 className="cfd-title" id="cfd-title">
          CFD
          <span className="dot">.</span>
        </h2>
        <p className="cfd-intro">{META.heroCfd.phrase}</p>
      </header>

      <div className="controls">
        <div className="size-pills" role="group" aria-label="CFD account size">
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
            {rows.map(({ firm, program, plan }) => (
              <tr key={`${firm.id}-${program.name}`} className="firm-row">
                <td className="col-firm" data-label="Program">
                  <span className="firm-row-id cfd-row-id">
                    {firm.logo && (
                      <img className="firm-logo" src={firm.logo} alt="" width={22} height={22} loading="lazy" />
                    )}
                    <span className="cfd-firm-label">{firm.name}</span>
                    <span className="firm-row-name">{program.name}</span>
                    <span className="firm-row-meta">
                      {/* each fact stays on one line: "1:100 FX" must not break after the ratio */}
                      {[program.steps, `${program.split} split`, program.leverage].map((t) => t.replace(/ /g, '\u00a0')).join(' · ')}
                    </span>
                    <span className="cfd-note">{program.note}</span>
                    {firm.promo && (
                      <span className="promo-chip" title={firm.promo.label}>
                        code {firm.promo.code}
                      </span>
                    )}
                  </span>
                </td>
                <td className="num cell-price" data-label="Price">
                  <span className="price-line">
                    {money(finalPrice(firm, plan))}
                    {firm.discount && <s className="price-was">{money(plan.price)}</s>}
                  </span>
                  {firm.discount && (
                    <span className="activation-note">
                      {firm.discount.discountPct}% off with code {firm.discount.code}
                      {firm.discount.appliedByLink ? ', applied by the link' : ''}
                    </span>
                  )}
                  {program.minDays && <span className="activation-note">min {program.minDays}</span>}
                </td>
                <td className="num cell-target" data-label="Profit target">
                  {program.profitTarget ?? <span className="none">None</span>}
                </td>
                <td className="num cell-loss" data-label="Max loss limit">
                  {program.maxDrawdown ? (
                    <>
                      {program.maxDrawdown} {program.ddType && <span className="dd-tag">{program.ddType}</span>}
                    </>
                  ) : (
                    <span className="none">n/c</span>
                  )}
                </td>
                <td className="num cell-daily" data-label="Daily loss">
                  {limitCell(program.dailyLoss)}
                </td>
                <td className="col-cta">
                  <a className="row-cta" href={goHref('prop-firms', firm.id)} target="_blank" rel="noopener nofollow sponsored">
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
        <p>Every limit is a percentage of your starting balance, the way CFD firms publish them</p>
        <p>Static — the loss limit never moves · Trailing — it follows your closed balance up to your starting balance, then stops</p>
        {rows.some((r) => !r.program.maxDrawdown || r.program.dailyLoss == null) && (
          <p>n/c — the firm does not publish that limit per program</p>
        )}
      </div>
      <p className="note">{NOTE}</p>
    </section>
  );
}
