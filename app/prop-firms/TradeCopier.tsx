'use client';

import { goHref } from '@/lib/go-links';

/*
 * The « Trade copier » tab of /prop-firms: Tradecopia, the copier Angelo uses (affiliate,
 * code JTNQ). Was its own page /trade-copier from 13/10/2026; moved here as a third tab next
 * to Futures and Perps on 31/10/2026 (Angelo: « le but est la même, promouvoir ce que
 * j'utilise donc je pense go merge les 2 », then « ouais 3eme bouton »). Texts, cards and
 * link are the old page's, unchanged.
 *
 * Audience discount: « 30% off the first month ». Stated on tradecopia.com/affiliates on
 * 08/09/2026; gone from /affiliates and /legal/affiliate-terms when read again on 13/10/2026.
 * Angelo, 13/10/2026: show « 30% off first month » anyway (he knows the code still gives it).
 *
 * Cards: Tradecopia share cards from Angelo's Lucid group, wins and losses mixed (his choice),
 * newest first. Label retouched to « CODE JTNQ » with recode.py like the cards he posts.
 * The 14/09 card is left out: it shows Blue Guardian, a partner removed from the site.
 */

const CARDS = [
  { date: '2026-10-13', label: 'October 13, 2026', pnl: '+$193.50' },
  { date: '2026-10-09', label: 'October 9, 2026', pnl: '−$817.50' },
  { date: '2026-10-08', label: 'October 8, 2026', pnl: '+$1,401.00' },
  { date: '2026-10-07', label: 'October 7, 2026', pnl: '+$3,129.00' },
  { date: '2026-09-30', label: 'September 30, 2026', pnl: '+$1,767.50' },
  { date: '2026-09-29', label: 'September 29, 2026', pnl: '−$2,073.50' },
  { date: '2026-09-24', label: 'September 24, 2026', pnl: '−$480.50' },
  { date: '2026-09-23', label: 'September 23, 2026', pnl: '+$1,978.50' },
];

// The footer disclaimer while this tab is open (the old /trade-copier page's, word for word).
export const TRADE_COPIER_DISCLAIMER =
  'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of Tradecopia and earns a commission on subscriptions made with code JTNQ. The P&L cards are past results on my own accounts and do not predict future results.';

export function TradeCopierPanel() {
  return (
    <div className="tcp">
      <p className="tcp-phrase">Tradecopia is the copier I use to copy my trades across my accounts.</p>

      <div className="tcp-code-row">
        <span className="tcp-code">
          <span className="tcp-code-k">Code</span>
          <span className="tcp-code-v">JTNQ</span>
        </span>
        <a className="tcp-cta" href={goHref('trade-copier', 'tradecopia')}>
          Open Tradecopia
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>
      <p className="tcp-code-note">30% off your first month</p>

      <section className="tcp-days" aria-labelledby="tcp-days-title">
        <div className="tcp-days-head">
          <h2 className="tcp-days-title" id="tcp-days-title">
            My days
          </h2>
          <p className="tcp-days-caption">Real daily P&amp;L cards from my accounts, wins and losses, newest first.</p>
        </div>

        <ul className="tcp-cards">
          {CARDS.map((c, i) => (
            <li key={c.date} className="tcp-card">
              <img
                src={`/trade-copier/pnl-${c.date}.webp`}
                alt={`Tradecopia daily P&L, ${c.label}: ${c.pnl}`}
                width={720}
                height={900}
                loading={i < 4 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Same look as the old page, scoped under the /prop-firms root (.jtnq-cmp shares its tokens).
export const TRADE_COPIER_CSS = `
.jtnq-cmp .tcp{ width: 100%; margin-top: 32px; text-align: center; }
.jtnq-cmp .tcp-phrase{
  margin: 0 auto; max-width: 40ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 2.1vw, 24px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft); text-wrap: balance;
}
.jtnq-cmp .tcp-code-row{
  margin: 32px auto 0;
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 16px 24px;
}
.jtnq-cmp .tcp-code{
  display: inline-flex; align-items: baseline; gap: 12px;
  padding: 12px 24px; border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line));
  background: color-mix(in oklab, var(--c-accent) 6%, var(--c-bg));
}
.jtnq-cmp .tcp-code-k{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-cmp .tcp-code-v{
  font-family: var(--f-mono); font-weight: 500; font-size: 20px; letter-spacing: .12em; color: var(--c-accent);
}
.jtnq-cmp .tcp-code-note{
  margin: 16px 0 0; text-align: center;
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-cmp a.tcp-cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 500; font-size: 15px; color: var(--c-bg); background: var(--c-accent);
  padding: 12px 24px; border-radius: 999px; white-space: nowrap; text-decoration: none;
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .4), 0 8px 24px oklch(0.78 0.14 75 / .18);
  transition: transform .2s ease, box-shadow .2s ease;
}
.jtnq-cmp .tcp-cta svg{ width: 14px; height: 14px; }
.jtnq-cmp .tcp-cta:hover{ transform: translateY(-1px); box-shadow: 0 2px 4px oklch(0.05 0.02 165 / .4), 0 12px 32px oklch(0.78 0.14 75 / .28); }

.jtnq-cmp .tcp-days{ margin-top: 64px; text-align: left; }
.jtnq-cmp .tcp-days-head{
  display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 32px;
  padding-top: 24px; border-top: 1px solid var(--c-line); margin-bottom: clamp(24px, 3vw, 32px);
}
.jtnq-cmp .tcp-days-title{
  margin: 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.02em; color: var(--c-text);
}
.jtnq-cmp .tcp-days-caption{
  margin: 0; font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-mute); max-width: 48ch;
}
.jtnq-cmp .tcp-cards{
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(16px, 2vw, 24px);
}
@media (max-width: 900px){ .jtnq-cmp .tcp-cards{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
.jtnq-cmp .tcp-card img{
  display: block; width: 100%; height: auto;
  filter: drop-shadow(0 1px 2px oklch(0.05 0.02 165 / .5)) drop-shadow(0 12px 24px oklch(0.05 0.02 165 / .35));
  transition: transform .3s cubic-bezier(.2,.7,.3,1);
}
.jtnq-cmp .tcp-card:hover img{ transform: translateY(-4px); }
@media (max-width: 720px){
  .jtnq-cmp .tcp-phrase{ font-size: 16px; }
  .jtnq-cmp .tcp-code-v{ font-size: 18px; }
}
@media (prefers-reduced-motion: reduce){
  .jtnq-cmp .tcp *{ transition: none !important; }
}
`;
