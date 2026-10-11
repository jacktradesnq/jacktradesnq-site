'use client';

// Shared chrome for /prop-firms: the design tokens + component CSS, the page copy
// and the number formatters.

export const money = (n: number) =>
  '$' + n.toLocaleString('en-US', Number.isInteger(n) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sizeLabel = (n: number) => '$' + n / 1000 + 'K';

export const META = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'FUTURES \u00b7 PERPS \u00b7 CFD',
    title: 'Prop firms',
    phrase:
      'Futures, perps and CFD firms I\u2019m partnered with. Pick one to see all of its plans side by side \u2014 account sizes, prices and risk rules. My code JTNQ or tracked link applied on every button.',
  },
  legal: {
    copyright: '\u00a9 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer \u2014 In accordance with article D.321-1 of the French Mon\u00e9taire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of the prop firms listed and earns a commission on sign-ups made with code JTNQ.',
  },
};

export const CSS = `
@font-face{
  font-family:'JetBrains Mono';
  font-style:normal; font-weight:400 500; font-display:swap;
  src:url('/fonts/JetBrainsMono.woff2') format('woff2');
}
@font-face{
  font-family:'Zodiak';
  font-style:normal; font-weight:700; font-display:swap;
  src:url('/fonts/Zodiak-Bold.woff2') format('woff2');
}
.jtnq-cmp{
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
.jtnq-cmp a{ color: inherit; text-decoration: none; }
.jtnq-cmp ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-cmp .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 22px var(--pad-x); display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.jtnq-cmp .back{
  font-family: var(--f-sans); font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-cmp .back .arr{ width: 14px; height: 14px; }
.jtnq-cmp .back:hover{ color: var(--c-accent); gap: 12px; }

.jtnq-cmp .hero{
  position: relative; padding: clamp(120px, 15vh, 168px) var(--pad-x) clamp(48px, 6vw, 72px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-cmp .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 15%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-cmp .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px; margin-bottom: clamp(24px, 3.5vw, 40px);
}
.jtnq-cmp .eyebrow::before, .jtnq-cmp .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-cmp .wordmark{
  font-family: 'Zodiak', var(--f-serif); font-weight: 700;
  font-size: clamp(52px, 9vw, 132px); line-height: .92; letter-spacing: -0.028em; margin: 0; color: var(--c-text);
}
.jtnq-cmp .wordmark .dot{ color: var(--c-accent); }
.jtnq-cmp .phrase{
  margin: clamp(24px, 3.5vw, 40px) auto 0; max-width: 46ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 2.1vw, 25px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft); text-wrap: balance;
}

@media (prefers-reduced-motion: reduce){
  .jtnq-cmp *{ transition: none !important; }
}

.jtnq-cmp .promo-chip{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; font-weight: 400;
  letter-spacing: .1em; text-transform: uppercase; color: var(--c-accent);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); border-radius: 999px;
  padding: 3px 9px; white-space: nowrap; cursor: help;
}
/* Firm whose prices did not come from the last daily sync: muted, not accent —
   it is a caveat, not an offer. */
.jtnq-cmp .stale-chip{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; font-weight: 400;
  letter-spacing: .1em; text-transform: uppercase; color: var(--c-text-mute);
  border: 1px dashed var(--c-line); border-radius: 999px;
  padding: 3px 9px; white-space: nowrap; cursor: help;
}
.jtnq-cmp .soft-flag{
  margin-left: 8px; font-size: 10px; font-weight: 400; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); cursor: help;
}
.jtnq-cmp .none{ color: var(--c-text-mute); font-weight: 400; font-size: 13px; }
.jtnq-cmp .tag{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--c-line); color: var(--c-text-soft); white-space: nowrap;
  font-weight: 400;
}
.jtnq-cmp .tag-trail{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .tag-eod{ color: var(--c-text-soft); }

.jtnq-cmp .row-cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-weight: 500; font-size: 13px; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 8px 13px; border-radius: 999px; white-space: nowrap;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-cmp .row-cta svg{ width: 12px; height: 12px; }
.jtnq-cmp .row-cta:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-cmp .legend{
  display: flex; flex-direction: column; gap: 6px; margin: 16px 0 0;
}
.jtnq-cmp .legend p{
  margin: 0; font-family: var(--f-mono); font-size: 11px; line-height: 1.5; color: var(--c-text-mute);
}

.jtnq-cmp .note{
  margin: clamp(24px, 3vw, 32px) 0 0; max-width: 78ch;
  font-family: var(--f-sans); font-size: 13px; line-height: 1.6; color: var(--c-text-mute); text-wrap: pretty;
}

.jtnq-cmp .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-cmp .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-cmp .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-cmp .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-cmp .footer-brand .dot{ color: var(--c-accent); }
.jtnq-cmp .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-cmp .footer-meta{ text-align: left; } }
.jtnq-cmp .footer-meta a{ color: var(--c-text-soft); }
.jtnq-cmp .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-cmp .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-cmp .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}

@media (max-width: 720px){
  .jtnq-cmp .hero{ padding: 72px var(--pad-x) 32px; }
  .jtnq-cmp .wordmark{ font-size: clamp(40px, 13vw, 60px); }
  .jtnq-cmp .phrase{ font-size: 14px; margin-top: 20px; }
}
`;
