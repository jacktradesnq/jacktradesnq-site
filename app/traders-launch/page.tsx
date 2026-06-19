'use client';

import { useEffect, useState } from 'react';

// Affiliate / discount code negotiated with Traders Launch (Josh).
// Code "JTNQ" = 15% off for the buyer + 15% commission for JackTradesNQ.
const CODE = 'JTNQ';
const DISCOUNT = '15% OFF';

// TODO(JTNQ): replace with the dedicated affiliate tracking link once Josh sends it.
// For now this points to the real Traders Launch site so the CTA is never dead —
// the code JTNQ is applied at checkout.
const AFFILIATE_URL = 'https://traderslaunch.com/';

const TL = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'PROP FIRM PARTNER',
    title: 'Traders Launch',
    phrase:
      'Daily payouts, one-step funding, and no consistency rules once you’re in — the firm I put my name behind.',
  },
  what: ['1-STEP EVALUATION', 'DAILY PAYOUTS', 'UP TO $300K', '80% PROFIT SPLIT', 'NO CONSISTENCY RULES'],
  firm: [
    {
      k: 'Funding',
      v: 'Accounts up to $300,000, traded on NinjaTrader, TradingView or Quantower.',
    },
    {
      k: 'Payouts',
      v: 'Paid daily with no caps — first payout in as little as three days, up to an 80% split.',
    },
    {
      k: 'Rules',
      v: 'One-step evaluation. No consistency rules once funded. No hidden activation fees.',
    },
  ],
  closer: {
    lead: 'Get funded, and keep more of what you make.',
    cta: { label: 'Get funded with JTNQ', url: AFFILIATE_URL },
  },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. JackTradesNQ is an affiliate of Traders Launch and may earn a commission on sign-ups made with code JTNQ.',
  },
};

export default function TradersLaunch() {
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
    <div className="jtnq-tl">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={TL.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{TL.backToHome.label}</span>
            </a>
            <a className="back-join" href={TL.closer.cta.url} target="_blank" rel="noopener nofollow sponsored">
              Get funded
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>

          <div className="eyebrow">{TL.hero.eyebrow}</div>
          <h1 className="wordmark">
            {TL.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{TL.hero.phrase}</p>
        </section>

        <section className="what">
          {TL.what.map((w, i) => (
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
            <h2>Why Traders Launch</h2>
            <span className="count">1-step · futures &amp; crypto</span>
          </div>
          <div className="firm-grid">
            {TL.firm.map((f) => (
              <div className="firm-card" key={f.k}>
                <span className="k">{f.k}</span>
                <p className="v">{f.v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="closer">
          <p className="lead">{TL.closer.lead}</p>

          <div className="code-block">
            <span className="code-label">Affiliate code · {DISCOUNT}</span>
            <button type="button" className="code-row" onClick={copyCode} aria-label={`Copy discount code ${CODE}`}>
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
            <span className="code-note">Apply {CODE} at checkout for {DISCOUNT.toLowerCase()} any Traders Launch challenge.</span>
          </div>

          <a className="cta" href={TL.closer.cta.url} target="_blank" rel="noopener nofollow sponsored">
            <span>{TL.closer.cta.label}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
          <div className="note">
            <span className="gold">·</span>
            <span>{DISCOUNT}</span>
            <span className="gold">·</span>
            <span>CODE {CODE}</span>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {TL.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={TL.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={TL.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{TL.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{TL.legal.disclaimer}</p>
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
.jtnq-tl{
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
.jtnq-tl a{ color: inherit; text-decoration: none; }
.jtnq-tl ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-tl .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 22px var(--pad-x); display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.jtnq-tl .back{
  font-family: var(--f-sans); font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-tl .back .arr{ width: 14px; height: 14px; }
.jtnq-tl .back:hover{ color: var(--c-accent); gap: 12px; }
.jtnq-tl .back-join{
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 7px 16px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 7px;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-tl .back-join svg{ width: 11px; height: 11px; }
.jtnq-tl .back-join:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-tl .hero{
  position: relative; padding: clamp(130px, 16vh, 180px) var(--pad-x) clamp(72px, 9vw, 104px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-tl .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 16%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-tl .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px;
  margin-bottom: clamp(28px, 4vw, 44px);
}
.jtnq-tl .eyebrow::before, .jtnq-tl .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-tl .wordmark{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(56px, 10vw, 150px); line-height: .9; letter-spacing: -0.035em; margin: 0; color: var(--c-text);
}
.jtnq-tl .wordmark .dot{ color: var(--c-accent); }
.jtnq-tl .phrase{
  margin: clamp(28px, 4vw, 44px) auto 0; max-width: 40ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(20px, 2.3vw, 28px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft);
  text-wrap: balance;
}

.jtnq-tl .what{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(36px, 5vw, 56px) var(--pad-x);
  border-top: 1px solid var(--c-line-soft); border-bottom: 1px solid var(--c-line-soft);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: clamp(14px, 2vw, 24px) clamp(18px, 3vw, 36px); text-align: center;
  font-family: var(--f-mono); font-size: clamp(11px, 1.05vw, 13px); letter-spacing: .24em;
  text-transform: uppercase; color: var(--c-text);
}
.jtnq-tl .what .item{ display: inline-block; }
.jtnq-tl .what .sep{ color: var(--c-accent); opacity: .9; font-size: 14px; line-height: 0; transform: translateY(-1px); display: inline-block; }

.jtnq-tl .firm{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(64px, 8vw, 96px) var(--pad-x) clamp(48px, 7vw, 80px);
}
.jtnq-tl .section-head{
  display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
  margin-bottom: clamp(32px, 4vw, 48px); padding-bottom: 18px; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-tl .section-head h2{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(26px, 3.2vw, 40px); line-height: 1; letter-spacing: -0.02em; margin: 0; color: var(--c-text);
}
.jtnq-tl .section-head .count{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-tl .firm-grid{
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(20px, 2.4vw, 28px);
}
@media (max-width: 760px){ .jtnq-tl .firm-grid{ grid-template-columns: 1fr; } }
.jtnq-tl .firm-card{
  background: var(--c-bg-raise); border: 1px solid var(--c-line);
  padding: clamp(24px, 2.8vw, 32px); transition: border-color .25s ease;
}
.jtnq-tl .firm-card:hover{ border-color: var(--c-accent); }
.jtnq-tl .firm-card .k{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 9px;
}
.jtnq-tl .firm-card .k::before{ content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); }
.jtnq-tl .firm-card .v{
  margin: clamp(16px, 1.8vw, 20px) 0 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 1.55vw, 21px); line-height: 1.42; letter-spacing: -0.005em; color: var(--c-text); text-wrap: pretty;
}

.jtnq-tl .closer{
  position: relative; padding: clamp(72px, 10vw, 116px) var(--pad-x) clamp(72px, 10vw, 112px);
  text-align: center; border-top: 1px solid var(--c-line-soft); overflow: hidden; isolation: isolate;
}
.jtnq-tl .closer::before{
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(50% 80% at 50% 100%, color-mix(in oklab, var(--c-accent) 18%, transparent) 0%, transparent 70%);
  pointer-events: none; z-index: -1;
}
.jtnq-tl .closer .lead{
  font-family: var(--f-serif); font-style: italic; font-size: clamp(22px, 2.6vw, 32px);
  line-height: 1.3; letter-spacing: -0.015em; color: var(--c-text); max-width: 22ch;
  margin: 0 auto clamp(36px, 4.5vw, 52px); text-wrap: balance;
}

.jtnq-tl .code-block{
  max-width: 440px; margin: 0 auto clamp(36px, 4.5vw, 52px);
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 4%);
  border: 1px solid var(--c-line);
  border-radius: 12px; padding: clamp(24px, 3vw, 32px) clamp(22px, 3vw, 30px);
  display: flex; flex-direction: column; align-items: center; gap: clamp(16px, 2vw, 20px);
  box-shadow: 0 1px 0 0 color-mix(in oklab, var(--c-accent) 12%, transparent) inset,
              0 24px 60px -32px color-mix(in oklab, var(--c-accent) 40%, transparent);
}
.jtnq-tl .code-label{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-tl .code-row{
  appearance: none; cursor: pointer; width: 100%;
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  background: var(--c-bg-deep); border: 1px dashed color-mix(in oklab, var(--c-accent) 55%, var(--c-line));
  border-radius: 8px; padding: clamp(14px, 1.8vw, 18px) clamp(16px, 2.2vw, 22px);
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.jtnq-tl .code-row:hover{ border-color: var(--c-accent); transform: translateY(-1px); }
.jtnq-tl .code-row:focus-visible{ outline: 2px solid var(--c-accent); outline-offset: 3px; }
.jtnq-tl .code-row .code{
  font-family: var(--f-mono); font-weight: 500; font-size: clamp(28px, 4.5vw, 40px);
  letter-spacing: .14em; color: var(--c-text); line-height: 1;
}
.jtnq-tl .code-row .copy{
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-tl .code-row .copy svg{ width: 14px; height: 14px; }
.jtnq-tl .code-note{
  font-family: var(--f-sans); font-size: 13px; line-height: 1.5; color: var(--c-text-mute); max-width: 34ch;
}

.jtnq-tl .cta{
  display: inline-flex; align-items: center; gap: 14px; background: var(--c-accent); color: var(--c-bg);
  font-family: var(--f-sans); font-weight: 500; font-size: clamp(16px, 1.6vw, 19px); letter-spacing: -0.01em;
  padding: clamp(18px, 1.8vw, 22px) clamp(32px, 3.6vw, 44px); border-radius: 999px;
  transition: transform .25s ease, background .25s ease, gap .25s ease;
}
.jtnq-tl .cta:hover{ transform: translateY(-2px); gap: 18px; background: oklch(0.83 0.14 78); }
.jtnq-tl .cta svg{ width: 16px; height: 16px; }
.jtnq-tl .note{
  margin-top: clamp(22px, 2.6vw, 30px); font-family: var(--f-mono); font-size: 11px;
  letter-spacing: .26em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-tl .note .gold{ color: var(--c-accent); margin: 0 8px; }

.jtnq-tl .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-tl .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-tl .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-tl .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-tl .footer-brand .dot{ color: var(--c-accent); }
.jtnq-tl .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-tl .footer-meta{ text-align: left; } }
.jtnq-tl .footer-meta a{ color: var(--c-text-soft); }
.jtnq-tl .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-tl .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-tl .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}
`;
