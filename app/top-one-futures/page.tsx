'use client';

import { useEffect, useState } from 'react';

// Affiliate code negotiated with Top One Futures (coupon "JTNQ", activated).
const CODE = 'JTNQ';

// Real affiliate tracking link from the Top One Futures (Trackdesk) dashboard.
const AFFILIATE_URL = 'https://toponefutures.com/?linkId=lp_707970&sourceId=jtnq&tenantId=toponefutures';

// Live pricing → straight to the checkout, where real per-plan prices are visible
// immediately and the JTNQ code auto-applies (attributes the sale via the coupon).
const PLANS_URL = 'https://checkout.toponefutures.com/?linkId=lp_707970&sourceId=jtnq&tenantId=toponefutures';

const TOP = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'PROP FIRM PARTNER',
    title: 'Top One Futures',
    phrase:
      'A 90/10 split, fast payouts, and several ways to get funded. The prop firm I actually trade.',
  },
  what: ['FAST PAYOUTS', '90/10 PROFIT SPLIT', '1-STEP & INSTANT', 'UP TO $150K'],
  firm: [
    {
      k: 'Funding',
      v: 'Several ways in: one-step evaluations and instant-funding accounts, from $25K to $150K.',
    },
    {
      k: 'Payouts',
      v: 'Fast payouts across the board. On the Elite Daily plan you can withdraw roughly every 24 hours once funded.',
    },
    {
      k: 'Rules',
      v: 'On the Elite Daily plan there’s no consistency rule once funded. Other plans run a 15 to 40% rule.',
    },
  ],
  plansIntro: 'Top One sells a few different account types. They all run a 90/10 profit split, so the real choice is how you want to get funded, how fast you can withdraw, and how strict the funded rules are.',
  plansShared: ['90/10 profit split', 'Futures sim accounts'],
  plans: [
    {
      name: 'Elite Access',
      tag: 'Most forgiving eval',
      bestFor: 'you keep blowing evaluations on a bad session, or you swing / trade the news and need room to breathe',
      what:
        'A one-step evaluation with no daily loss limit during the challenge. You pass a profit target once, then trade funded. Drawdown only updates on the daily close, so an intraday spike won’t end your account.',
      facts: ['One-step evaluation', 'No daily loss limit on the challenge', 'End-of-day trailing drawdown', 'Loosest funded consistency rule'],
    },
    {
      name: 'Elite Daily',
      tag: 'Daily payouts',
      bestFor: 'you want frequent withdrawals and would rather not have a consistency rule once funded',
      what:
        'A one-phase evaluation that, once funded, is built around frequent withdrawals: you can request a payout roughly every 24 hours, and it uniquely carries no consistency rule on the funded account. You keep a profit buffer after each withdrawal.',
      facts: ['One-phase evaluation', 'Withdraw ~every 24h once funded', 'No funded consistency rule'],
    },
    {
      name: 'Instant Sim Funded',
      tag: 'Skip the eval',
      bestFor: 'you’d rather start trading funded capital today than pass a challenge first',
      what:
        'Instant funding, with no evaluation to clear. You trade simulated capital from day one, with a mid-tier consistency rule that leaves more headroom than the cheapest instant plan.',
      facts: ['Instant funding, no evaluation', 'More consistency headroom than IGNITE', 'A breach closes the account'],
    },
    {
      name: 'IGNITE Instant Funding',
      tag: 'Most popular',
      bestFor: 'you’re a scalper or high-volume trader who grinds small consistent wins and wants to scale across several accounts',
      what:
        'The cheapest way to skip the evaluation, designed for running multiple accounts at once. The trade-off is its tight funded rules: one oversized day can set you back, so it rewards discipline.',
      facts: ['Instant funding, no evaluation', 'Strictest funded consistency rule', 'Built to scale multiple accounts'],
    },
  ],
  closer: {
    lead: 'Pick how you want in. Every plan pays 90/10.',
    cta: { label: 'Get funded with JTNQ', url: AFFILIATE_URL },
  },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of Top One Futures and earns a commission on sign-ups made with code JTNQ.',
  },
};

export default function TopOneFutures() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.12 0.008 60)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  const copyCode = () => {
    // Optimistic feedback — the code is also shown in plain text, so the user is
    // never blocked even if the clipboard API is unavailable.
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    try {
      navigator.clipboard?.writeText(CODE).catch(() => {});
    } catch {
      /* clipboard unavailable — code stays visible to type manually */
    }
  };

  return (
    <div className="jtnq-top">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={TOP.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{TOP.backToHome.label}</span>
            </a>
            <a className="back-join" href={TOP.closer.cta.url} target="_blank" rel="noopener nofollow sponsored">
              Get funded
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>

          <span className="firm-mark" aria-hidden="true">
            <svg viewBox="-2 -2.3 105.5 97.4" fill="none">
              <path d="M42.7381 1.01227L3.77665 23.4988C1.44256 24.8485 0 27.3436 0 30.043V75.0285C0 77.7279 1.44256 80.2229 3.77665 81.5726L36.6026 100.524C38.2804 101.496 40.3792 100.283 40.3792 98.3447V44.97L8.75441 63.228V51.8176L46.5086 30.0182L84.2627 51.8176V63.228L52.6379 44.97V98.3447C52.6379 100.283 54.7367 101.496 56.4145 100.524L89.2405 81.5726C91.5808 80.2229 93.0171 77.7279 93.0171 75.0285V30.043C93.0171 27.3436 91.5746 24.8485 89.2405 23.4988L50.2914 1.01227C47.9511 -0.337422 45.0722 -0.337422 42.7381 1.01227ZM31.6248 60.1386V87.5348L8.7606 74.3351L31.6248 60.1386ZM61.4047 87.5348V60.1386L84.2689 74.3351L61.4047 87.5348ZM84.2689 41.7073L46.5148 19.9079L8.75441 41.7073V30.7364L46.5148 8.93705L84.2689 30.7364V41.7073Z" fill="currentColor" />
            </svg>
          </span>
          <div className="eyebrow">{TOP.hero.eyebrow}</div>
          <h1 className="wordmark">
            {TOP.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{TOP.hero.phrase}</p>
        </section>

        <section className="what">
          {TOP.what.map((w, i) => (
            <span key={w} style={{ display: 'contents' }}>
              {i > 0 && (
                <span className="sep" aria-hidden="true">
                  ·
                </span>
              )}
              <span className="item">{w}</span>
            </span>
          ))}
        </section>

        <section className="firm">
          <div className="section-head">
            <h2>Why Top One Futures</h2>
            <span className="count">1-step · futures</span>
          </div>
          <div className="firm-grid">
            {TOP.firm.map((f) => (
              <div className="firm-card" key={f.k}>
                <span className="k">{f.k}</span>
                <p className="v">{f.v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="plans">
          <div className="section-head">
            <h2>Which account fits you</h2>
            <span className="count">{TOP.plans.length} ways to get funded</span>
          </div>
          <p className="plans-intro">{TOP.plansIntro}</p>
          <div className="shared">
            <span className="shared-label">Every plan</span>
            {TOP.plansShared.map((s, i) => (
              <span key={s} style={{ display: 'contents' }}>
                {i > 0 && <span className="shared-sep" aria-hidden="true">·</span>}
                <span className="shared-item">{s}</span>
              </span>
            ))}
          </div>

          <ol className="plan-list">
            {TOP.plans.map((p) => (
              <li className="plan" key={p.name}>
                <div className="plan-head">
                  <h3 className="plan-name">{p.name}</h3>
                  <span className="plan-tag">{p.tag}</span>
                </div>
                <div className="plan-body">
                  <p className="plan-best">
                    <span className="lbl">Best if</span> {p.bestFor}.
                  </p>
                  <p className="plan-what">{p.what}</p>
                  <ul className="plan-facts">
                    {p.facts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>

          <a className="plans-link" href={PLANS_URL} target="_blank" rel="noopener nofollow sponsored">
            See live pricing on Top One
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </section>

        <section className="closer">
          <p className="lead">{TOP.closer.lead}</p>

          <div className="code-block">
            <span className="code-label">Affiliate code</span>
            <button type="button" className="code-row" onClick={copyCode} aria-label={`Copy code ${CODE}`}>
              <span className="code">{CODE}</span>
              <span className="copy">
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </span>
            </button>
            <span className="code-note">Apply {CODE} at checkout for an exclusive discount on Top One Futures.</span>
          </div>

          <a className="cta" href={TOP.closer.cta.url} target="_blank" rel="noopener nofollow sponsored">
            <span>{TOP.closer.cta.label}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
          <div className="note">
            <span className="gold">·</span>
            <span>CODE {CODE}</span>
            <span className="gold">·</span>
            <span>AFFILIATE</span>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {TOP.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={TOP.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={TOP.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{TOP.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{TOP.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

const CSS = `
@font-face{
  font-family:'JetBrains Mono';
  font-style:normal;
  font-weight:400 500;
  font-display:swap;
  src:url('/fonts/JetBrainsMono.woff2') format('woff2');
}
.jtnq-top{
  --c-bg: oklch(0.12 0.008 60);
  --c-bg-raise: oklch(0.16 0.012 58);
  --c-bg-deep: oklch(0.10 0.008 60);
  --c-text: oklch(0.94 0.028 85);
  --c-text-soft: oklch(0.78 0.022 80);
  --c-text-mute: oklch(0.52 0.018 75);
  --c-text-deep: oklch(0.36 0.015 70);
  --c-accent: oklch(0.78 0.14 75);
  --c-line: oklch(0.26 0.012 65);
  --c-line-soft: oklch(0.20 0.010 62);
  --f-serif: 'Fraunces', 'Times New Roman', serif;
  --f-sans: 'Satoshi', system-ui, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
  --maxw: 1200px;
  --pad-x: clamp(24px, 5vw, 64px);
  font-family: var(--f-sans);
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.jtnq-top a{ color: inherit; text-decoration: none; }
.jtnq-top ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-top .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 22px var(--pad-x); display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.jtnq-top .back{
  font-family: var(--f-sans); font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-top .back .arr{ width: 14px; height: 14px; }
.jtnq-top .back:hover{ color: var(--c-accent); gap: 12px; }
.jtnq-top .back-join{
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 7px 16px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 7px;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-top .back-join svg{ width: 11px; height: 11px; }
.jtnq-top .back-join:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-top .hero{
  position: relative; padding: clamp(130px, 16vh, 180px) var(--pad-x) clamp(72px, 9vw, 104px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-top .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 16%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-top .firm-mark{
  display: block; margin: 0 auto clamp(22px, 3vw, 30px);
  width: clamp(40px, 5vw, 52px); color: var(--c-text-soft);
}
.jtnq-top .firm-mark svg{ display: block; width: 100%; height: auto; }
.jtnq-top .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px;
  margin-bottom: clamp(28px, 4vw, 44px);
}
.jtnq-top .eyebrow::before, .jtnq-top .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-top .wordmark{
  font-family: 'Zodiak', var(--f-serif); font-style: normal; font-weight: 700;
  font-size: clamp(48px, 8.6vw, 128px); line-height: .92; letter-spacing: -0.028em; margin: 0; color: var(--c-text);
}
.jtnq-top .wordmark .dot{ color: var(--c-accent); }
.jtnq-top .phrase{
  margin: clamp(28px, 4vw, 44px) auto 0; max-width: 42ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(20px, 2.3vw, 28px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft);
  text-wrap: balance;
}

.jtnq-top .what{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(36px, 5vw, 56px) var(--pad-x);
  border-top: 1px solid var(--c-line-soft); border-bottom: 1px solid var(--c-line-soft);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: clamp(14px, 2vw, 24px) clamp(18px, 3vw, 36px); text-align: center;
  font-family: var(--f-mono); font-size: clamp(11px, 1.05vw, 13px); letter-spacing: .24em;
  text-transform: uppercase; color: var(--c-text);
}
.jtnq-top .what .item{ display: inline-block; }
.jtnq-top .what .sep{ color: var(--c-accent); opacity: .9; font-size: 14px; line-height: 0; transform: translateY(-1px); display: inline-block; }

.jtnq-top .firm{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(64px, 8vw, 96px) var(--pad-x) clamp(48px, 7vw, 80px);
}
.jtnq-top .section-head{
  display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
  margin-bottom: clamp(32px, 4vw, 48px); padding-bottom: 18px; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-top .section-head h2{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(26px, 3.2vw, 40px); line-height: 1; letter-spacing: -0.02em; margin: 0; color: var(--c-text);
}
.jtnq-top .section-head .count{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-top .firm-grid{
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(20px, 2.4vw, 28px);
}
@media (max-width: 760px){ .jtnq-top .firm-grid{ grid-template-columns: 1fr; } }
.jtnq-top .firm-card{
  background: var(--c-bg-raise); border: 1px solid var(--c-line);
  padding: clamp(24px, 2.8vw, 32px); transition: border-color .25s ease;
}
.jtnq-top .firm-card:hover{ border-color: var(--c-accent); }
.jtnq-top .firm-card .k{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 9px;
}
.jtnq-top .firm-card .k::before{ content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); }
.jtnq-top .firm-card .v{
  margin: clamp(16px, 1.8vw, 20px) 0 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 1.55vw, 21px); line-height: 1.42; letter-spacing: -0.005em; color: var(--c-text); text-wrap: pretty;
}
.jtnq-top .plans-link{
  margin-top: clamp(28px, 3vw, 36px); display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--f-mono); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--c-text-soft);
  transition: color .2s ease, gap .2s ease;
}
.jtnq-top .plans-link svg{ width: 13px; height: 13px; }
.jtnq-top .plans-link:hover{ color: var(--c-accent); gap: 13px; }

.jtnq-top .plans{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(56px, 8vw, 88px) var(--pad-x) clamp(56px, 8vw, 88px);
  border-top: 1px solid var(--c-line-soft);
}
.jtnq-top .plans-intro{
  margin: clamp(20px, 2.6vw, 28px) 0 0; max-width: 64ch;
  font-family: var(--f-sans); font-size: clamp(15px, 1.3vw, 17px); line-height: 1.6; color: var(--c-text-soft);
}
.jtnq-top .shared{
  margin: clamp(22px, 2.6vw, 30px) 0 clamp(8px, 1vw, 14px); display: flex; flex-wrap: wrap; align-items: center;
  gap: 8px 14px; font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--c-text);
}
.jtnq-top .shared-label{ color: var(--c-accent); margin-right: 4px; }
.jtnq-top .shared-sep{ color: var(--c-accent); opacity: .8; }
.jtnq-top .plan-list{ list-style: none; margin: 0; padding: 0; counter-reset: plan; }
.jtnq-top .plan{
  counter-increment: plan; display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.55fr);
  gap: clamp(16px, 4vw, 56px); padding: clamp(28px, 3.4vw, 40px) 0; border-top: 1px solid var(--c-line);
}
.jtnq-top .plan:last-child{ border-bottom: 1px solid var(--c-line); }
@media (max-width: 760px){ .jtnq-top .plan{ grid-template-columns: 1fr; gap: 16px; } }
.jtnq-top .plan-head{ display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.jtnq-top .plan-name{
  margin: 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(26px, 2.8vw, 38px); line-height: 1.02; letter-spacing: -0.02em; color: var(--c-text); text-wrap: balance;
}
.jtnq-top .plan-name::before{
  content: counter(plan, decimal-leading-zero); display: block; margin-bottom: 10px;
  font-family: var(--f-mono); font-style: normal; font-size: 11px; letter-spacing: .2em; color: var(--c-text-deep);
}
.jtnq-top .plan-tag{
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--c-accent);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); border-radius: 999px; padding: 5px 11px;
}
.jtnq-top .plan-best{
  margin: 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(17px, 1.5vw, 21px); line-height: 1.4; letter-spacing: -0.005em; color: var(--c-text); text-wrap: pretty;
}
.jtnq-top .plan-best .lbl{
  font-family: var(--f-mono); font-style: normal; font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); margin-right: 9px; vertical-align: middle;
}
.jtnq-top .plan-what{
  margin: clamp(12px, 1.4vw, 16px) 0 0; font-family: var(--f-sans); font-size: 14.5px; line-height: 1.6; color: var(--c-text-soft);
}
.jtnq-top .plan-facts{
  list-style: none; margin: clamp(16px, 1.8vw, 20px) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 10px;
}
.jtnq-top .plan-facts li{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .04em; color: var(--c-text-soft);
  background: var(--c-bg-raise); border: 1px solid var(--c-line); border-radius: 999px; padding: 6px 13px;
}

.jtnq-top .closer{
  position: relative; padding: clamp(72px, 10vw, 116px) var(--pad-x) clamp(72px, 10vw, 112px);
  text-align: center; border-top: 1px solid var(--c-line-soft); overflow: hidden; isolation: isolate;
}
.jtnq-top .closer::before{
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(50% 80% at 50% 100%, color-mix(in oklab, var(--c-accent) 18%, transparent) 0%, transparent 70%);
  pointer-events: none; z-index: -1;
}
.jtnq-top .closer .lead{
  font-family: var(--f-serif); font-style: italic; font-size: clamp(22px, 2.6vw, 32px);
  line-height: 1.3; letter-spacing: -0.015em; color: var(--c-text); max-width: 22ch;
  margin: 0 auto clamp(36px, 4.5vw, 52px); text-wrap: balance;
}

.jtnq-top .code-block{
  max-width: 440px; margin: 0 auto clamp(36px, 4.5vw, 52px);
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 4%);
  border: 1px solid var(--c-line);
  border-radius: 12px; padding: clamp(24px, 3vw, 32px) clamp(22px, 3vw, 30px);
  display: flex; flex-direction: column; align-items: center; gap: clamp(16px, 2vw, 20px);
  box-shadow: 0 1px 0 0 color-mix(in oklab, var(--c-accent) 12%, transparent) inset,
              0 24px 60px -32px color-mix(in oklab, var(--c-accent) 40%, transparent);
}
.jtnq-top .code-label{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-top .code-row{
  appearance: none; cursor: pointer; width: 100%;
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  background: var(--c-bg-deep); border: 1px dashed color-mix(in oklab, var(--c-accent) 55%, var(--c-line));
  border-radius: 8px; padding: clamp(14px, 1.8vw, 18px) clamp(16px, 2.2vw, 22px);
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.jtnq-top .code-row:hover{ border-color: var(--c-accent); transform: translateY(-1px); }
.jtnq-top .code-row:focus-visible{ outline: 2px solid var(--c-accent); outline-offset: 3px; }
.jtnq-top .code-row .code{
  font-family: var(--f-mono); font-weight: 500; font-size: clamp(28px, 4.5vw, 40px);
  letter-spacing: .14em; color: var(--c-text); line-height: 1;
}
.jtnq-top .code-row .copy{
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-top .code-row .copy svg{ width: 14px; height: 14px; }
.jtnq-top .code-note{
  font-family: var(--f-sans); font-size: 13px; line-height: 1.5; color: var(--c-text-mute); max-width: 34ch;
}

.jtnq-top .cta{
  display: inline-flex; align-items: center; gap: 14px; background: var(--c-accent); color: var(--c-bg);
  font-family: var(--f-sans); font-weight: 500; font-size: clamp(16px, 1.6vw, 19px); letter-spacing: -0.01em;
  padding: clamp(18px, 1.8vw, 22px) clamp(32px, 3.6vw, 44px); border-radius: 999px;
  transition: transform .25s ease, background .25s ease, gap .25s ease;
}
.jtnq-top .cta:hover{ transform: translateY(-2px); gap: 18px; background: oklch(0.83 0.14 78); }
.jtnq-top .cta svg{ width: 16px; height: 16px; }
.jtnq-top .note{
  margin-top: clamp(22px, 2.6vw, 30px); font-family: var(--f-mono); font-size: 11px;
  letter-spacing: .26em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-top .note .gold{ color: var(--c-accent); margin: 0 8px; }

.jtnq-top .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-top .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-top .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-top .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-top .footer-brand .dot{ color: var(--c-accent); }
.jtnq-top .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-top .footer-meta{ text-align: left; } }
.jtnq-top .footer-meta a{ color: var(--c-text-soft); }
.jtnq-top .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-top .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-top .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}
`;
