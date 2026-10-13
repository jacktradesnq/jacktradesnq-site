import { goHref } from '@/lib/go-links';

/*
 * /trade-copier — Tradecopia, the copier Angelo uses (affiliate, code JTNQ). Asked 13/10/2026.
 *
 * Audience discount: none shown. On 08/09/2026 tradecopia.com/affiliates said the audience got
 * « 30% off the first month »; read again on 13/10/2026, neither /affiliates nor
 * /legal/affiliate-terms mentions any discount for referred users any more (only the
 * affiliate's « Up to 15% recurring commission »). The page only shows what is still stated:
 * the code.
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

const LEGAL = {
  copyright: '© 2026 JackTradesNQ. All rights reserved.',
  mentionsUrl: '/mentions-legales/',
  privacyUrl: '/politique-confidentialite/',
  disclaimer:
    'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of Tradecopia and earns a commission on subscriptions made with code JTNQ. The P&L cards are past results on my own accounts and do not predict future results.',
};

export default function TradeCopier() {
  return (
    <div className="jtnq-tc">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href="/">
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Jacktradesnq</span>
            </a>
          </div>

          <div className="eyebrow">Tradecopia</div>
          <h1 className="wordmark">
            Trade copier
            <span className="dot">.</span>
          </h1>
          <p className="phrase">Tradecopia is the copier I use to copy my trades across my accounts.</p>

          <div className="code-row">
            <span className="code">
              <span className="code-k">Code</span>
              <span className="code-v">JTNQ</span>
            </span>
            <a className="cta" href={goHref('trade-copier', 'tradecopia')}>
              Open Tradecopia
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>
        </section>

        <section className="days" aria-labelledby="days-title">
          <div className="days-head">
            <h2 className="days-title" id="days-title">
              My days
            </h2>
            <p className="days-caption">Real daily P&amp;L cards from my accounts, wins and losses, newest first.</p>
          </div>

          <ul className="tc-cards">
            {CARDS.map((c, i) => (
              <li key={c.date} className="tc-card">
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
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            Jacktradesnq
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={LEGAL.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={LEGAL.privacyUrl}>Privacy policy</a>
            <br />
            <span>{LEGAL.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{LEGAL.disclaimer}</p>
      </footer>
    </div>
  );
}

const CSS = `
@font-face{
  font-family:'JetBrains Mono';
  font-style:normal; font-weight:400 500; font-display:swap;
  src:url('/fonts/JetBrainsMono.woff2') format('woff2');
}
body:has(.jtnq-tc){ background: oklch(0.13 0.028 165); }
.jtnq-tc{
  --c-bg: oklch(0.13 0.028 165);
  --c-bg-raise: oklch(0.17 0.032 165);
  --c-bg-deep: oklch(0.11 0.025 165);
  --c-text: oklch(0.95 0.025 95);
  --c-text-soft: oklch(0.78 0.025 120);
  --c-text-mute: oklch(0.55 0.025 140);
  --c-text-deep: oklch(0.38 0.02 150);
  --c-accent: oklch(0.78 0.14 75);
  --c-line: oklch(0.27 0.032 165);
  --c-line-soft: oklch(0.22 0.028 165);
  --f-serif: 'Fraunces', 'Times New Roman', serif;
  --f-sans: 'Satoshi', system-ui, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
  --maxw: 1120px;
  --pad-x: clamp(24px, 5vw, 64px);
  font-family: var(--f-sans);
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.jtnq-tc a{ color: inherit; text-decoration: none; }
.jtnq-tc ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-tc .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 24px var(--pad-x); display: flex; align-items: center;
}
.jtnq-tc .back{
  font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-tc .back .arr{ width: 14px; height: 14px; }
.jtnq-tc .back:hover{ color: var(--c-accent); gap: 12px; }

.jtnq-tc .hero{
  position: relative; padding: clamp(120px, 15vh, 168px) var(--pad-x) clamp(48px, 6vw, 64px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-tc .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 15%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-tc .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px; margin-bottom: clamp(24px, 3.5vw, 40px);
}
.jtnq-tc .eyebrow::before, .jtnq-tc .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-tc .wordmark{
  font-family: 'Zodiak', var(--f-serif); font-weight: 700;
  font-size: clamp(52px, 9vw, 132px); line-height: .92; letter-spacing: -0.028em; margin: 0; color: var(--c-text);
}
.jtnq-tc .wordmark .dot{ color: var(--c-accent); }
.jtnq-tc .phrase{
  margin: clamp(24px, 3.5vw, 40px) auto 0; max-width: 40ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 2.1vw, 24px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft); text-wrap: balance;
}

.jtnq-tc .code-row{
  margin: clamp(32px, 4vw, 48px) auto 0;
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 16px 24px;
}
.jtnq-tc .code{
  display: inline-flex; align-items: baseline; gap: 12px;
  padding: 12px 24px; border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line));
  background: color-mix(in oklab, var(--c-accent) 6%, var(--c-bg));
}
.jtnq-tc .code-k{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-tc .code-v{
  font-family: var(--f-mono); font-weight: 500; font-size: 20px; letter-spacing: .12em; color: var(--c-accent);
}
.jtnq-tc .cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 500; font-size: 15px; color: var(--c-bg); background: var(--c-accent);
  padding: 12px 24px; border-radius: 999px; white-space: nowrap;
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .4), 0 8px 24px oklch(0.78 0.14 75 / .18);
  transition: transform .2s ease, box-shadow .2s ease;
}
.jtnq-tc .cta svg{ width: 14px; height: 14px; }
.jtnq-tc .cta:hover{ transform: translateY(-1px); box-shadow: 0 2px 4px oklch(0.05 0.02 165 / .4), 0 12px 32px oklch(0.78 0.14 75 / .28); }

.jtnq-tc .days{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(32px, 5vw, 64px) var(--pad-x) clamp(64px, 8vw, 96px);
}
.jtnq-tc .days-head{
  display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 32px;
  padding-top: 24px; border-top: 1px solid var(--c-line); margin-bottom: clamp(24px, 3vw, 32px);
}
.jtnq-tc .days-title{
  margin: 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.02em; color: var(--c-text);
}
.jtnq-tc .days-caption{
  margin: 0; font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-mute); max-width: 48ch;
}
.jtnq-tc .tc-cards{
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(16px, 2vw, 24px);
}
@media (max-width: 900px){ .jtnq-tc .tc-cards{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
.jtnq-tc .tc-card img{
  display: block; width: 100%; height: auto;
  filter: drop-shadow(0 1px 2px oklch(0.05 0.02 165 / .5)) drop-shadow(0 12px 24px oklch(0.05 0.02 165 / .35));
  transition: transform .3s cubic-bezier(.2,.7,.3,1);
}
.jtnq-tc .tc-card:hover img{ transform: translateY(-4px); }

.jtnq-tc .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-tc .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-tc .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-tc .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-tc .footer-brand .dot{ color: var(--c-accent); }
.jtnq-tc .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-tc .footer-meta{ text-align: left; } }
.jtnq-tc .footer-meta a{ color: var(--c-text-soft); }
.jtnq-tc .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-tc .footer-meta .sep{ color: var(--c-text-deep); margin: 0 8px; }
.jtnq-tc .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}

@media (max-width: 720px){
  .jtnq-tc .hero{ padding: 72px var(--pad-x) 32px; }
  .jtnq-tc .wordmark{ font-size: clamp(40px, 13vw, 60px); }
  .jtnq-tc .phrase{ font-size: 16px; margin-top: 20px; }
  .jtnq-tc .code-v{ font-size: 18px; }
}
@media (prefers-reduced-motion: reduce){
  .jtnq-tc *{ transition: none !important; }
}
`;
