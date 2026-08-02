'use client';

import { useEffect, useMemo, useState } from 'react';
import rawCfdData from '@/public/data/cfd-firms.json';
import { AssetNav, CSS, META, money, sizeLabel } from './shared';

// CFD and crypto programs live in their own file and their own pages: they are
// sized in percentages (target, daily loss, drawdown) with leverage instead of
// contract counts, so nothing here maps onto the futures table next door.
// Both markets render the same table — only the rows differ — so the whole page
// lives here and each route just picks its market.
type CfdMarket = 'cfd' | 'crypto';
type CfdPlan = { size: number; price: number };
type CfdProgram = {
  name: string;
  market: CfdMarket;
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
type CfdFirm = {
  id: string;
  name: string;
  logo: string;
  payout: string;
  promo: { label: string; code: string } | null;
  url: string;
  lastChecked: string;
  stale: boolean;
  programs: CfdProgram[];
};
type CfdData = { generatedAt: string; firms: CfdFirm[] };

const DATA = rawCfdData as unknown as CfdData;

const NOTE = `Prices and rules read on each firm's own program pages and checkout on ${DATA.generatedAt}, not auto-synced yet. Every button opens the checkout with my affiliate code already filled in — the live checkout price wins.`;

const DEFAULT_SIZE: Record<CfdMarket, number> = { cfd: 25000, crypto: 25000 };

export default function MarketComparator({ market }: { market: CfdMarket }) {
  const [size, setSize] = useState(DEFAULT_SIZE[market]);
  const hero = market === 'crypto' ? META.heroCrypto : META.heroCfd;

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.13 0.028 165)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  const sizes = useMemo(() => {
    const all = new Set<number>();
    for (const firm of DATA.firms)
      for (const program of firm.programs)
        if (program.market === market) for (const plan of program.plans) all.add(plan.size);
    return [...all].sort((a, b) => a - b);
  }, [market]);

  // One row per program rather than per firm: the risk rules are what separate
  // them, so there is no per-firm "cheapest plan" worth collapsing to.
  const rows = useMemo(() => {
    const out: { firm: CfdFirm; program: CfdProgram; plan: CfdPlan }[] = [];
    for (const firm of DATA.firms)
      for (const program of firm.programs) {
        if (program.market !== market) continue;
        const plan = program.plans.find((p) => p.size === size);
        if (plan) out.push({ firm, program, plan });
      }
    return out.sort((a, b) => a.plan.price - b.plan.price);
  }, [market, size]);

  return (
    <div className="jtnq-cmp">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={META.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{META.backToHome.label}</span>
            </a>
          </div>

          <div className="eyebrow">{hero.eyebrow}</div>
          <h1 className="wordmark">
            {META.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{hero.phrase}</p>
        </section>

        <section className="table-section">
          <AssetNav current={market} />

          <div className="controls">
            <div className="size-pills" role="group" aria-label="Account size">
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
                  <th><span className="h">Price today</span></th>
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
                        <img className="firm-logo" src={firm.logo} alt="" width={22} height={22} loading="lazy" />
                        <span className="cfd-firm-label">{firm.name}</span>
                        <span className="firm-row-name">{program.name}</span>
                        <span className="firm-row-meta">
                          {[program.steps, `${program.split} split`, program.leverage].join(' · ')}
                        </span>
                        <span className="cfd-note">{program.note}</span>
                        {firm.promo && (
                          <span className="promo-chip" title={firm.promo.label}>
                            code {firm.promo.code}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="num cell-price" data-label="Price today">
                      <span className="price-line">{money(plan.price)}</span>
                      {program.minDays && <span className="activation-note">min {program.minDays}</span>}
                    </td>
                    <td className="num cell-target" data-label="Profit target">
                      {program.profitTarget ?? <span className="none">None</span>}
                    </td>
                    <td className="num cell-loss" data-label="Max loss limit">
                      {program.maxDrawdown ? (
                        <>
                          {program.maxDrawdown} <span className="dd-tag">{program.ddType}</span>
                        </>
                      ) : (
                        <span className="none">n/c</span>
                      )}
                    </td>
                    <td className="num cell-daily" data-label="Daily loss">
                      {program.dailyLoss ?? <span className="none">n/c</span>}
                    </td>
                    <td className="col-cta">
                      <a className="row-cta" href={firm.url} target="_blank" rel="noopener nofollow sponsored">
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
            <p>Every limit is a percentage of your starting balance, the way {market === 'crypto' ? 'crypto' : 'CFD'} firms publish them</p>
            <p>Static — the loss limit never moves · Trailing — it follows your closed balance until you bank the profit</p>
            {rows.some((r) => !r.program.maxDrawdown || !r.program.dailyLoss) && (
              <p>n/c — the firm does not publish that limit per program</p>
            )}
          </div>
          <p className="note">{NOTE}</p>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {META.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={META.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={META.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{META.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{META.legal.disclaimer}</p>
      </footer>
    </div>
  );
}
