'use client';

// Shared chrome for the two comparator pages (/prop-firms and /prop-firms/cfd):
// the design tokens + component CSS, the page copy, the number formatters and
// the futures/CFD switch. Both pages render the same shell, only the table
// differs, so this lives outside either page to avoid pulling one page's data
// into the other's bundle.

export const money = (n: number) =>
  '$' + n.toLocaleString('en-US', Number.isInteger(n) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sizeLabel = (n: number) => '$' + n / 1000 + 'K';

export const META = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'FUTURES PROP FIRMS',
    title: 'Prop firms',
    phrase:
      'Every plan from the firms I\u2019m partnered with \u2014 account sizes, prices and risk rules, side by side. My code JTNQ or tracked link applied on every button.',
  },
  heroCfd: {
    eyebrow: 'CFD PROP FIRMS',
    phrase:
      'The forex and indices programs I\u2019m partnered with \u2014 targets, drawdown and daily loss as a percentage of your balance, side by side. My tracked link on every button.',
  },
  heroCrypto: {
    eyebrow: 'CRYPTO PROP FIRMS',
    phrase:
      'The crypto programs I\u2019m partnered with \u2014 targets, drawdown and daily loss as a percentage of your balance, leverage per coin, side by side. My tracked link on every button.',
  },
  legal: {
    copyright: '\u00a9 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer \u2014 In accordance with article D.321-1 of the French Mon\u00e9taire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of the prop firms listed and earns a commission on sign-ups made with code JTNQ.',
  },
};

// Same segmented control on every page, but each entry is a link: one URL per
// asset class means each can be shared and indexed on its own.
export type AssetClass = 'futures' | 'cfd' | 'crypto';

const ASSET_TABS: { id: AssetClass; label: string; href: string }[] = [
  { id: 'futures', label: 'Futures', href: '/prop-firms/' },
  { id: 'cfd', label: 'CFD', href: '/prop-firms/cfd/' },
  { id: 'crypto', label: 'Crypto', href: '/prop-firms/crypto/' },
];

export function AssetNav({ current }: { current: AssetClass }) {
  return (
    <div className="class-toggle" role="group" aria-label="Asset class">
      {ASSET_TABS.map((tab) => (
        <a
          key={tab.id}
          className={`mode ${current === tab.id ? 'active' : ''}`}
          href={tab.href}
          aria-current={current === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}

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

.jtnq-cmp .table-section{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(32px, 4vw, 48px) var(--pad-x) clamp(72px, 9vw, 104px);
}

.jtnq-cmp .controls{
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 24px;
}
.jtnq-cmp .size-pills{ display: flex; flex-wrap: wrap; gap: 8px; }
.jtnq-cmp .pill{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-soft); background: none; border: 1px solid var(--c-line); border-radius: 999px;
  padding: 8px 16px; cursor: pointer; transition: color .2s ease, border-color .2s ease, background .2s ease;
}
.jtnq-cmp .pill:hover{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .pill.active{ color: var(--c-bg); background: var(--c-accent); border-color: var(--c-accent); }
.jtnq-cmp .mode-toggle{
  display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--c-line); border-radius: 999px;
  background: var(--c-bg-raise);
}
.jtnq-cmp .mode{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-mute); background: none; border: none; border-radius: 999px;
  padding: 8px 16px; cursor: pointer; transition: color .2s ease, background .2s ease;
}
.jtnq-cmp .mode:hover{ color: var(--c-accent); }
.jtnq-cmp .mode.active{ color: var(--c-bg); background: var(--c-accent); }

.jtnq-cmp .table-wrap{
  overflow-x: auto; border: 1px solid var(--c-line); border-radius: 14px; background: var(--c-bg-raise);
  -webkit-overflow-scrolling: touch;
}
.jtnq-cmp table{ width: 100%; min-width: 880px; border-collapse: collapse; }
.jtnq-cmp thead th{
  text-align: left; padding: 0; border-bottom: 1px solid var(--c-line);
  background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%);
}
.jtnq-cmp .h{
  display: inline-flex; align-items: center; width: 100%;
  padding: clamp(16px, 1.8vw, 20px) clamp(10px, 1.2vw, 14px);
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--c-text-mute);
  white-space: nowrap;
}

.jtnq-cmp tbody tr{ border-bottom: 1px solid var(--c-line-soft); transition: background .2s ease; }
.jtnq-cmp tbody tr:last-child{ border-bottom: none; }
.jtnq-cmp tbody tr:hover{ background: color-mix(in oklab, var(--c-bg-raise) 82%, var(--c-accent) 6%); }
.jtnq-cmp td{ padding: 16px clamp(10px, 1.2vw, 14px); vertical-align: middle; }

.jtnq-cmp .col-firm{ position: sticky; left: 0; z-index: 1; background: var(--c-bg-raise); }
.jtnq-cmp thead .col-firm{ background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%); }
.jtnq-cmp tbody tr:hover .col-firm{ background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 6%); }

.jtnq-cmp .row-expand-btn{
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer;
}
.jtnq-cmp .chevron{
  width: 14px; height: 14px; flex-shrink: 0; color: var(--c-accent); transition: transform .2s ease, color .2s ease;
}
.jtnq-cmp .row-expand-btn:hover .chevron{ color: var(--c-accent); }
.jtnq-cmp .row-expand-btn[aria-expanded="true"] .chevron{ transform: rotate(90deg); color: var(--c-accent); }
.jtnq-cmp .plan-count{
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); white-space: nowrap;
}

.jtnq-cmp .firm-row-id{ display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 8px; row-gap: 4px; min-width: 0; }
.jtnq-cmp .firm-logo{
  grid-row: 1 / -1; width: 22px; height: 22px; border-radius: 5px; object-fit: contain; flex-shrink: 0;
}
.jtnq-cmp .firm-row-name{
  grid-column: 2; display: block; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(19px, 1.8vw, 23px); letter-spacing: -0.01em; color: var(--c-text); line-height: 1.1;
}
.jtnq-cmp .firm-row-meta{
  grid-column: 2; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--c-text-mute);
}

.jtnq-cmp td.num{ font-family: var(--f-mono); font-size: clamp(15px, 1.4vw, 18px); font-weight: 500; color: var(--c-text); letter-spacing: .01em; white-space: nowrap; }
.jtnq-cmp .cell-price{ white-space: normal; }
.jtnq-cmp .price-line{ display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.jtnq-cmp .price-was{ font-size: 12px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .price-from{ font-size: 11px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .per{ font-size: 11px; color: var(--c-text-mute); }
.jtnq-cmp .activation-note{
  display: block; margin-top: 4px; font-family: var(--f-sans); font-size: 11px; font-style: italic;
  font-weight: 400; color: var(--c-text-mute); white-space: nowrap;
}
.jtnq-cmp .cell-loss .tag{ margin-left: 4px; }

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
.jtnq-cmp tr.empty-row td{ padding: 28px 16px; text-align: center; font-family: var(--f-mono); font-size: 12px; color: var(--c-text-mute); }
.jtnq-cmp tbody tr.empty-row:hover{ background: none; }
.jtnq-cmp .tag{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--c-line); color: var(--c-text-soft); white-space: nowrap;
  font-weight: 400;
}
.jtnq-cmp .tag-trail{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .tag-eod{ color: var(--c-text-soft); }

.jtnq-cmp .class-toggle{
  display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 22px;
  border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-raise);
}
.jtnq-cmp .dd-tag{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--c-line); color: var(--c-text-soft); white-space: nowrap;
}
/* Program names are short and known — keep them on one line so the CFD table
   stays as narrow as the futures one and the CTA column never gets pushed out. */
/* Program names are short and known — keep them on one line, and pin the first
   column so the rule text wraps inside it instead of spilling over the price. */
.jtnq-cmp .cfd-table .col-firm, .jtnq-cmp .cfd-table .cell-firm{ width: 320px; }
.jtnq-cmp .cfd-row-id{ max-width: 300px; }
.jtnq-cmp .cfd-row-id > *{ min-width: 0; overflow-wrap: anywhere; }
.jtnq-cmp .cfd-row-id .firm-row-name{ white-space: nowrap; }
.jtnq-cmp .cfd-row-id .firm-row-meta{ display: block; white-space: normal; }
.jtnq-cmp .cfd-note{
  grid-column: 2; font-family: var(--f-sans); font-size: 12px; font-style: italic;
  color: var(--c-text-mute); line-height: 1.35;
}
/* Everything stacks in column 2 next to the logo — left in column 1 the chip
   would sit alone under the icon with a dead gap above it. */
.jtnq-cmp .cfd-firm-label{
  grid-column: 2; font-family: var(--f-mono); font-size: 10px; letter-spacing: .18em;
  text-transform: uppercase; color: var(--c-accent);
}
.jtnq-cmp .cfd-row-id .promo-chip{ grid-column: 2; justify-self: start; }


.jtnq-cmp .col-cta{ text-align: right; white-space: nowrap; }
.jtnq-cmp .row-cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-weight: 500; font-size: 13px; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 8px 13px; border-radius: 999px; white-space: nowrap;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-cmp .row-cta svg{ width: 12px; height: 12px; }
.jtnq-cmp .row-cta:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-cmp .expand-cell{ padding: 0; }
.jtnq-cmp .expand-wrap{
  display: grid; grid-template-rows: 0fr; transition: grid-template-rows .2s ease;
}
.jtnq-cmp .expand-wrap.is-open{ grid-template-rows: 1fr; }
.jtnq-cmp .expand-panel{
  overflow: hidden; min-height: 0; display: flex; flex-direction: column;
  padding: 0 clamp(16px, 1.8vw, 22px);
  background: color-mix(in oklab, var(--c-bg-raise) 80%, var(--c-bg-deep) 20%);
  transition: padding .2s ease;
}
.jtnq-cmp .expand-wrap.is-open .expand-panel{ padding: 12px clamp(16px, 1.8vw, 22px); }
.jtnq-cmp tbody tr.expand-row{ border-bottom: none; }
.jtnq-cmp .sub-row{
  display: flex; flex-wrap: wrap; align-items: baseline;
  font-family: var(--f-mono); font-size: 12px; color: var(--c-text-soft);
  padding: 8px 0; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-cmp .sub-row:last-child{ border-bottom: none; }
.jtnq-cmp .sub-price{ display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.jtnq-cmp .sub-row > *{ margin-right: 10px; }
.jtnq-cmp .sub-row > *:not(:first-child)::before{ content: '· '; color: var(--c-text-deep); }
.jtnq-cmp .sub-name{ color: var(--c-text); font-weight: 500; }
.jtnq-cmp .sub-activation{ color: var(--c-text-mute); font-style: italic; }

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

/* ── hero link to /promos/ ── */
.jtnq-cmp .hero-promos{
  display: inline-flex; align-items: center; gap: 8px; margin-top: 28px;
  font-family: var(--f-sans); font-size: 14px; font-weight: 700; color: var(--c-bg);
  background: var(--c-accent); border-radius: 999px; padding: 12px 24px;
  transition: transform .18s ease;
}
.jtnq-cmp .hero-promos svg{ width: 14px; height: 14px; }
.jtnq-cmp .hero-promos:hover{ transform: translateY(-1px); }

@media (max-width: 720px){
  .jtnq-cmp .hero{ padding: 72px var(--pad-x) 32px; }
  .jtnq-cmp .wordmark{ font-size: clamp(40px, 13vw, 60px); }
  .jtnq-cmp .phrase{ font-size: 14px; margin-top: 20px; }

  .jtnq-cmp .table-wrap{ border: none; background: none; border-radius: 0; overflow: visible; }
  .jtnq-cmp table, .jtnq-cmp tbody, .jtnq-cmp tr, .jtnq-cmp td{ display: block; width: 100%; }
  .jtnq-cmp table{ min-width: 0; }
  .jtnq-cmp thead{ display: none; }

  .jtnq-cmp tr.firm-row{
    display: grid; grid-template-columns: 1fr 1fr;
    grid-template-areas: "firm firm" "target loss" "price daily" "cta cta";
    column-gap: 16px; row-gap: 16px;
    background: var(--c-bg-raise); border: 1px solid var(--c-line); border-radius: 14px;
    padding: 18px; margin-bottom: 12px;
  }
  .jtnq-cmp tr.firm-row td{ padding: 0; }

  .jtnq-cmp td.col-firm{ grid-area: firm; position: static; background: none; }
  .jtnq-cmp td.cell-target{ grid-area: target; }
  .jtnq-cmp td.cell-loss{ grid-area: loss; }
  .jtnq-cmp td.cell-price{ grid-area: price; }
  .jtnq-cmp td.cell-daily{ grid-area: daily; }
  .jtnq-cmp td.col-cta{ grid-area: cta; text-align: center; }

  .jtnq-cmp tr.firm-row td.num{ white-space: normal; }
  .jtnq-cmp td.cell-target, .jtnq-cmp td.cell-loss{ font-size: 20px; }
  .jtnq-cmp td.cell-price, .jtnq-cmp td.cell-daily{ font-size: 15px; }

  .jtnq-cmp td[data-label]::before{
    content: attr(data-label); display: block; margin-bottom: 4px;
    font-family: var(--f-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--c-text-mute);
  }

  /* The CFD table pins its first column on desktop to keep the CTA in view —
     on a phone the row is a card, so let it take the full width instead. */
  .jtnq-cmp .cfd-table .col-firm{ width: auto; }
  .jtnq-cmp .cfd-row-id{ max-width: none; }

  .jtnq-cmp .row-cta{ width: 100%; justify-content: center; padding: 14px 20px; }

  .jtnq-cmp tr.expand-row{ margin-bottom: 0; }
  .jtnq-cmp tr.expand-row:has(.is-open){ margin-bottom: 12px; }
  .jtnq-cmp .expand-cell{ padding: 0; }
  .jtnq-cmp .expand-wrap.is-open .expand-panel{
    border: 1px solid var(--c-line); border-radius: 14px; padding: 16px;
  }
}
`;
