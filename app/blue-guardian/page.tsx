'use client';

import { useEffect, useState } from 'react';

// Affiliate / referral code with Blue Guardian (Refer & Earn program).
// Code "JTNQ" = referral attribution for JackTradesNQ. Not advertised as a
// buyer discount — no buyer-side discount is confirmed for this code.
const CODE = 'JTNQ';

// Referral link straight to Blue Guardian with the JTNQ attribution applied
// (verified live on the Blue Guardian affiliate dashboard, 2026-07-16).
const AFFILIATE_URL = 'https://blueguardian.com/?afmc=JTNQ';

const BG = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'PROP FIRM PARTNER',
    title: 'Blue Guardian',
    phrase:
      'A 90% split on futures accounts up to $400K, with payouts you can request on demand.',
  },
  what: ['90% SPLIT', 'INSTANT PAYOUTS', 'NO ACTIVATION FEE', 'INSTANT & EVALUATION', 'TRAILING DRAWDOWN', '$5K – $400K'],
  firm: [
    {
      k: 'Funding',
      v: 'Instant-funding accounts and one- to three-step evaluations, from $5K to $400K. A one-time fee, no monthly subscription, on NinjaTrader, Tradovate, TradingView and DeepCharts.',
    },
    {
      k: 'Payouts',
      v: 'A 90% profit split with on-demand payouts. Approved withdrawals are processed within 24 hours, or Blue Guardian pays you an extra $1,000.',
    },
    {
      k: 'Rules',
      v: 'A trailing drawdown that follows your account’s highest balance, a fixed daily loss limit, and no time limit on the evaluation.',
    },
  ],
  closer: {
    lead: 'Pick a size and get funded.',
    cta: { label: 'Get funded with JTNQ', url: AFFILIATE_URL },
  },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of Blue Guardian and earns a commission on sign-ups made with code JTNQ.',
  },
};

export default function BlueGuardian() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.13 0.028 165)';
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
    <div className="jtnq-bg">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={BG.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{BG.backToHome.label}</span>
            </a>
            <a className="back-join" href={BG.closer.cta.url} target="_blank" rel="noopener nofollow sponsored">
              Get funded
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>

          <div className="eyebrow">{BG.hero.eyebrow}</div>
          <h1 className="wordmark">
            {BG.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{BG.hero.phrase}</p>
        </section>

        <section className="what">
          {BG.what.map((w, i) => (
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
            <h2>Why Blue Guardian</h2>
            <span className="count">instant &amp; evaluation · futures</span>
          </div>
          <div className="firm-grid">
            {BG.firm.map((f) => (
              <div className="firm-card" key={f.k}>
                <span className="k">{f.k}</span>
                <p className="v">{f.v}</p>
              </div>
            ))}
          </div>
          <a className="plans-link" href={AFFILIATE_URL} target="_blank" rel="noopener nofollow sponsored">
            See live plans &amp; pricing
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </section>

        <section className="closer">
          <p className="lead">{BG.closer.lead}</p>

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
            <span className="code-note">The link opens Blue Guardian with code {CODE} already applied, or enter it at sign-up.</span>
          </div>

          <a className="cta" href={BG.closer.cta.url} target="_blank" rel="noopener nofollow sponsored">
            <span>{BG.closer.cta.label}</span>
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
            {BG.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={BG.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={BG.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{BG.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{BG.legal.disclaimer}</p>
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
@font-face{
  font-family:'Zodiak';
  font-style:normal;
  font-weight:700;
  font-display:swap;
  src:url('/fonts/Zodiak-Bold.woff2') format('woff2');
}
.jtnq-bg{
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
  --maxw: 1200px;
  --pad-x: clamp(24px, 5vw, 64px);
  font-family: var(--f-sans);
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.jtnq-bg a{ color: inherit; text-decoration: none; }
.jtnq-bg ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-bg .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 22px var(--pad-x); display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.jtnq-bg .back{
  font-family: var(--f-sans); font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-bg .back .arr{ width: 14px; height: 14px; }
.jtnq-bg .back:hover{ color: var(--c-accent); gap: 12px; }
.jtnq-bg .back-join{
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 7px 16px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 7px;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-bg .back-join svg{ width: 11px; height: 11px; }
.jtnq-bg .back-join:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-bg .hero{
  position: relative; padding: clamp(130px, 16vh, 180px) var(--pad-x) clamp(72px, 9vw, 104px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-bg .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 16%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-bg .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px;
  margin-bottom: clamp(28px, 4vw, 44px);
}
.jtnq-bg .eyebrow::before, .jtnq-bg .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-bg .wordmark{
  font-family: 'Zodiak', var(--f-serif); font-style: normal; font-weight: 700;
  font-size: clamp(48px, 8.4vw, 128px); line-height: .92; letter-spacing: -0.028em; margin: 0; color: var(--c-text);
}
.jtnq-bg .wordmark .dot{ color: var(--c-accent); }
.jtnq-bg .phrase{
  margin: clamp(28px, 4vw, 44px) auto 0; max-width: 42ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(20px, 2.3vw, 28px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft);
  text-wrap: balance;
}

.jtnq-bg .what{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(36px, 5vw, 56px) var(--pad-x);
  border-top: 1px solid var(--c-line-soft); border-bottom: 1px solid var(--c-line-soft);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: clamp(14px, 2vw, 24px) clamp(18px, 3vw, 36px); text-align: center;
  font-family: var(--f-mono); font-size: clamp(11px, 1.05vw, 13px); letter-spacing: .24em;
  text-transform: uppercase; color: var(--c-text);
}
.jtnq-bg .what .item{ display: inline-block; }
.jtnq-bg .what .sep{ color: var(--c-accent); opacity: .9; font-size: 14px; line-height: 0; transform: translateY(-1px); display: inline-block; }

.jtnq-bg .firm{
  max-width: var(--maxw); margin: 0 auto;
  padding: clamp(64px, 8vw, 96px) var(--pad-x) clamp(48px, 7vw, 80px);
}
.jtnq-bg .section-head{
  display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
  margin-bottom: clamp(32px, 4vw, 48px); padding-bottom: 18px; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-bg .section-head h2{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(26px, 3.2vw, 40px); line-height: 1; letter-spacing: -0.02em; margin: 0; color: var(--c-text);
}
.jtnq-bg .section-head .count{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-bg .firm-grid{
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(20px, 2.4vw, 28px);
}
@media (max-width: 760px){ .jtnq-bg .firm-grid{ grid-template-columns: 1fr; } }
.jtnq-bg .firm-card{
  background: var(--c-bg-raise); border: 1px solid var(--c-line);
  padding: clamp(24px, 2.8vw, 32px); transition: border-color .25s ease;
}
.jtnq-bg .firm-card:hover{ border-color: var(--c-accent); }
.jtnq-bg .firm-card .k{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 9px;
}
.jtnq-bg .firm-card .k::before{ content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); }
.jtnq-bg .firm-card .v{
  margin: clamp(16px, 1.8vw, 20px) 0 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 1.55vw, 21px); line-height: 1.42; letter-spacing: -0.005em; color: var(--c-text); text-wrap: pretty;
}
.jtnq-bg .plans-link{
  margin-top: clamp(28px, 3vw, 36px); display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--f-mono); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--c-text-soft);
  transition: color .2s ease, gap .2s ease;
}
.jtnq-bg .plans-link svg{ width: 13px; height: 13px; }
.jtnq-bg .plans-link:hover{ color: var(--c-accent); gap: 13px; }

.jtnq-bg .closer{
  position: relative; padding: clamp(72px, 10vw, 116px) var(--pad-x) clamp(72px, 10vw, 112px);
  text-align: center; border-top: 1px solid var(--c-line-soft); overflow: hidden; isolation: isolate;
}
.jtnq-bg .closer::before{
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(50% 80% at 50% 100%, color-mix(in oklab, var(--c-accent) 18%, transparent) 0%, transparent 70%);
  pointer-events: none; z-index: -1;
}
.jtnq-bg .closer .lead{
  font-family: var(--f-serif); font-style: italic; font-size: clamp(22px, 2.6vw, 32px);
  line-height: 1.3; letter-spacing: -0.015em; color: var(--c-text); max-width: 22ch;
  margin: 0 auto clamp(36px, 4.5vw, 52px); text-wrap: balance;
}

.jtnq-bg .code-block{
  max-width: 440px; margin: 0 auto clamp(36px, 4.5vw, 52px);
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 4%);
  border: 1px solid var(--c-line);
  border-radius: 12px; padding: clamp(24px, 3vw, 32px) clamp(22px, 3vw, 30px);
  display: flex; flex-direction: column; align-items: center; gap: clamp(16px, 2vw, 20px);
  box-shadow: 0 1px 0 0 color-mix(in oklab, var(--c-accent) 12%, transparent) inset,
              0 24px 60px -32px color-mix(in oklab, var(--c-accent) 40%, transparent);
}
.jtnq-bg .code-label{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-bg .code-row{
  appearance: none; cursor: pointer; width: 100%;
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  background: var(--c-bg-deep); border: 1px dashed color-mix(in oklab, var(--c-accent) 55%, var(--c-line));
  border-radius: 8px; padding: clamp(14px, 1.8vw, 18px) clamp(16px, 2.2vw, 22px);
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.jtnq-bg .code-row:hover{ border-color: var(--c-accent); transform: translateY(-1px); }
.jtnq-bg .code-row:focus-visible{ outline: 2px solid var(--c-accent); outline-offset: 3px; }
.jtnq-bg .code-row .code{
  font-family: var(--f-mono); font-weight: 500; font-size: clamp(28px, 4.5vw, 40px);
  letter-spacing: .14em; color: var(--c-text); line-height: 1;
}
.jtnq-bg .code-row .copy{
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--c-accent);
}
.jtnq-bg .code-row .copy svg{ width: 14px; height: 14px; }
.jtnq-bg .code-note{
  font-family: var(--f-sans); font-size: 13px; line-height: 1.5; color: var(--c-text-mute); max-width: 36ch;
}

.jtnq-bg .cta{
  display: inline-flex; align-items: center; gap: 14px; background: var(--c-accent); color: var(--c-bg);
  font-family: var(--f-sans); font-weight: 500; font-size: clamp(16px, 1.6vw, 19px); letter-spacing: -0.01em;
  padding: clamp(18px, 1.8vw, 22px) clamp(32px, 3.6vw, 44px); border-radius: 999px;
  transition: transform .25s ease, background .25s ease, gap .25s ease;
}
.jtnq-bg .cta:hover{ transform: translateY(-2px); gap: 18px; background: oklch(0.83 0.14 78); }
.jtnq-bg .cta svg{ width: 16px; height: 16px; }
.jtnq-bg .note{
  margin-top: clamp(22px, 2.6vw, 30px); font-family: var(--f-mono); font-size: 11px;
  letter-spacing: .26em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-bg .note .gold{ color: var(--c-accent); margin: 0 8px; }

.jtnq-bg .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-bg .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-bg .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-bg .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-bg .footer-brand .dot{ color: var(--c-accent); }
.jtnq-bg .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-bg .footer-meta{ text-align: left; } }
.jtnq-bg .footer-meta a{ color: var(--c-text-soft); }
.jtnq-bg .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-bg .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-bg .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}
`;
