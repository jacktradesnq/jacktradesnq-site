// Styles of the family picker, the firm cards, a firm's window and the price / rule pieces on
// /prop-firms (page.tsx, FirmWindow.tsx, FirmTable.tsx). Tokens come from shared.tsx (.jtnq-cmp).

export const FAMILY_CSS = `
.jtnq-cmp .sr-only{
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.jtnq-cmp :is(button, a, [tabindex]):focus-visible{
  outline: 2px solid var(--c-accent); outline-offset: 3px;
}

.jtnq-cmp .fam-section{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(32px, 4vw, 48px) var(--pad-x) clamp(72px, 9vw, 104px);
  display: flex; flex-direction: column; align-items: center;
}
.jtnq-cmp .fam-tabs{
  display: inline-flex; gap: 4px; padding: 4px;
  border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-raise);
}
.jtnq-cmp .fam-tab{
  font-family: var(--f-sans); font-size: 14px;
  color: var(--c-text-mute); background: none; border: none; border-radius: 999px;
  padding: 12px 24px; cursor: pointer; transition: color .2s ease, background .2s ease;
}
.jtnq-cmp .fam-tab{ white-space: nowrap; }
/* Four tabs since « Prop compare » joined (01/11/2026): two rows of two on a phone, every tab the same size. */
@media (max-width: 560px){
  .jtnq-cmp .fam-tabs{ display: grid; grid-template-columns: 1fr 1fr; border-radius: 24px; width: 100%; max-width: 400px; }
  .jtnq-cmp .fam-tab{ padding: 12px 8px; }
}
.jtnq-cmp .fam-tab:hover{ color: var(--c-accent); }
.jtnq-cmp .fam-tab.active{ color: var(--c-bg); background: var(--c-accent); }
.jtnq-cmp .fam-panel{ width: 100%; }
.jtnq-cmp .fam-caption{
  margin: 24px 0 16px; text-align: center;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
}

/* The firm search: same look as the comparator's fields. 16px in the box so a phone does not zoom. */
.jtnq-cmp .firm-search{
  display: flex; align-items: center; gap: 8px; width: min(100%, 320px); height: 40px; padding: 0 12px;
  border: 1px solid var(--c-line); border-radius: 4px; background: var(--c-bg-deep); color: var(--c-text-soft);
  transition: border-color .2s ease;
}
.jtnq-cmp .firm-search:focus-within{ border-color: var(--c-accent); }
.jtnq-cmp .firm-search svg{ width: 16px; height: 16px; flex-shrink: 0; }
.jtnq-cmp .firm-search input{
  flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: none; padding: 0;
  font-family: var(--f-sans); font-size: 16px; color: var(--c-text); color-scheme: dark;
}
.jtnq-cmp .firm-search input::placeholder{ color: var(--c-text-soft); opacity: 1; }
.jtnq-cmp .fam-panel > .firm-search{ margin: 24px auto 0; }

/* Every card alike: same width, same height, same style — no firm put forward. */
.jtnq-cmp .firm-cards{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px;
  max-width: 720px; margin: 0 auto;
}
.jtnq-cmp .firm-cards:has(> :only-child){ max-width: 360px; }
.jtnq-cmp .firm-card{
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 16px; row-gap: 16px;
  width: 100%; text-align: left; font: inherit; color: inherit; cursor: pointer;
  padding: 20px 24px; border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-bg-raise);
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}
.jtnq-cmp .firm-card:hover{ border-color: color-mix(in oklab, var(--c-accent) 50%, var(--c-line)); transform: translateY(-1px); }
.jtnq-cmp .firm-mark{ border-radius: 8px; object-fit: contain; flex-shrink: 0; }
.jtnq-cmp .firm-mark--letter{
  display: inline-grid; place-items: center;
  font-family: var(--f-sans); font-size: 20px; color: var(--c-accent);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line));
  background: var(--c-bg-deep);
}
.jtnq-cmp .fc-body{ display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.jtnq-cmp .fc-name{
  font-family: var(--f-sans); font-weight: 400;
  font-size: 24px; line-height: 1.1; letter-spacing: -0.01em; color: var(--c-text);
}
.jtnq-cmp .fc-meta{
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
  line-height: 1.5;
}
.jtnq-cmp .fc-chips{ display: flex; flex-wrap: wrap; gap: 8px; }
.jtnq-cmp .fc-chips .promo-chip, .jtnq-cmp .fc-chips .stale-chip{ cursor: inherit; }
.jtnq-cmp .fc-side{
  grid-column: 1 / -1; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding-top: 16px; border-top: 1px solid var(--c-line-soft);
}
.jtnq-cmp .fc-from{ display: flex; flex-direction: column; gap: 4px; }
.jtnq-cmp .fc-from-k{
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
}
.jtnq-cmp .fc-from-v{ font-family: var(--f-sans); font-size: 20px; font-weight: 500; color: var(--c-text); }
.jtnq-cmp .fc-open{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-accent);
}
.jtnq-cmp .fc-chev{ width: 14px; height: 14px; transition: transform .2s ease; }
.jtnq-cmp .firm-card:hover .fc-chev{ transform: translate(2px, -2px); }

/* ── a firm's window ── */
.jtnq-cmp .firm-dialog{
  position: fixed; inset: 0; margin: auto; padding: 48px 0 0; border: none; background: transparent; color: inherit;
  width: min(640px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px);
  overflow-y: auto; overscroll-behavior: contain;
}
.jtnq-cmp .firm-dialog::backdrop{ background: oklch(0.07 0.02 165 / .8); backdrop-filter: blur(6px); }
.jtnq-cmp .fd-close{
  position: absolute; top: 0; right: 0; width: 40px; height: 40px; display: grid; place-items: center;
  border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-raise); color: var(--c-text);
  cursor: pointer; transition: border-color .2s ease, color .2s ease;
}
.jtnq-cmp .fd-close:hover{ border-color: var(--c-accent); color: var(--c-accent); }
.jtnq-cmp .fd-close svg{ width: 18px; height: 18px; }
html:has(.firm-dialog[open]){ overflow: hidden; }

@keyframes fw-in{ from{ opacity: 0; transform: translateY(8px); } to{ opacity: 1; transform: none; } }
.jtnq-cmp .fw{
  display: flex; flex-direction: column; gap: 24px; padding: 32px;
  border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-bg-raise);
  animation: fw-in .28s ease both;
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .35), 0 16px 40px -16px oklch(0.05 0.02 165 / .55);
}
@media (prefers-reduced-motion: reduce){ .jtnq-cmp .fw{ animation: none; } }
.jtnq-cmp .fw-head{ display: flex; align-items: center; gap: 16px; min-width: 0; }
.jtnq-cmp .fw-title{
  margin: 0; font-family: var(--f-sans); font-weight: 400;
  font-size: clamp(32px, 4vw, 44px); line-height: 1; letter-spacing: -0.02em; color: var(--c-text);
}
.jtnq-cmp .fw-intro p{
  margin: 0; font-family: var(--f-sans); font-size: 20px; line-height: 1.4; color: var(--c-text-soft); text-wrap: pretty;
}
.jtnq-cmp .fw-intro p + p{ margin-top: 12px; }
.jtnq-cmp .fw-take{ padding-top: 24px; border-top: 1px solid var(--c-line-soft); }
.jtnq-cmp .fw-take-k{
  margin: 0 0 12px; font-family: var(--f-sans); font-size: 14px; font-weight: 400; color: var(--c-accent);
}
.jtnq-cmp .fw-take p{ margin: 0; font-size: 16px; line-height: 1.6; color: var(--c-text); text-wrap: pretty; }
.jtnq-cmp .fw-take p + p{ margin-top: 12px; }
.jtnq-cmp .fw-actions{
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  padding-top: 24px; border-top: 1px solid var(--c-line-soft);
}
.jtnq-cmp .fw-actions .promo-chip{ cursor: help; }
.jtnq-cmp .fw-actions .row-cta{ margin-left: auto; padding: 12px 20px; font-size: 14px; }
.jtnq-cmp .fw-all{
  display: inline-flex; align-items: center; padding: 12px 20px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--c-line); background: none;
  font-family: var(--f-sans); font-size: 14px; font-weight: 500; color: var(--c-text);
  transition: border-color .2s ease, color .2s ease;
}
.jtnq-cmp .fw-all:hover{ border-color: var(--c-accent); color: var(--c-accent); }

.jtnq-cmp .perps-promo{
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0;
  padding: 12px 16px; border: 1px solid color-mix(in oklab, var(--c-accent) 35%, var(--c-line)); border-radius: 12px;
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 8%);
}
.jtnq-cmp .perps-promo-text{ font-size: 14px; color: var(--c-text); }
.jtnq-cmp .perps-clock{
  font-family: var(--f-sans); font-variant-numeric: tabular-nums; font-weight: 500; color: var(--c-accent);
  white-space: nowrap;
}

/* ── segmented buttons (the comparator's Futures / Perps) ── */
.jtnq-cmp .ft-seg{ display: inline-flex; flex-wrap: wrap; gap: 4px; }
.jtnq-cmp .ft-prog{
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-text-mute);
  background: none; border: none; border-radius: 999px; padding: 8px 16px; cursor: pointer;
  transition: color .2s ease, background .2s ease;
}
.jtnq-cmp .ft-prog:hover{ color: var(--c-accent); }
.jtnq-cmp .ft-prog.active{ color: var(--c-bg); background: var(--c-accent); }

/* ── a figure, a word, a price ── */
.jtnq-cmp .ft-fig{ font-family: var(--f-sans); font-size: 15px; font-weight: 500; color: var(--c-text); }
.jtnq-cmp .ft-word{ font-family: var(--f-sans); font-size: 15px; font-weight: 500; color: var(--c-text); line-height: 1.4; }
.jtnq-cmp .ft-fig + .tag{ margin-left: 8px; }
.jtnq-cmp .ft-price .price-was{ white-space: nowrap; }
.jtnq-cmp .ft-price{ display: inline-flex; align-items: baseline; justify-content: center; gap: 8px; flex-wrap: wrap; }
.jtnq-cmp .ft-now{ font-family: var(--f-sans); font-size: 17px; font-weight: 500; color: var(--c-text); }
.jtnq-cmp .price-was{ font-family: var(--f-sans); font-size: 14px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .price-sep{ font-family: var(--f-sans); font-size: 15px; color: var(--c-text-mute); }
.jtnq-cmp .price-from{ font-family: var(--f-sans); font-size: 14px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .per{ font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute); }

@media (max-width: 720px){
  .jtnq-cmp .firm-card{ padding: 16px; }
  .jtnq-cmp .fw{ padding: 24px 16px; gap: 16px; }
  .jtnq-cmp .fw-take, .jtnq-cmp .fw-actions{ padding-top: 16px; }
  .jtnq-cmp .fw-actions .row-cta{ margin-left: 0; }
}
`;
