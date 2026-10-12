// Styles of the family picker, the firm cards and the per-firm table on /prop-firms
// (page.tsx, FirmTable.tsx). Tokens come from shared.tsx (.jtnq-cmp).

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
  font-family: var(--f-mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--c-text-mute); background: none; border: none; border-radius: 999px;
  padding: 12px 24px; cursor: pointer; transition: color .2s ease, background .2s ease;
}
.jtnq-cmp .fam-tab:hover{ color: var(--c-accent); }
.jtnq-cmp .fam-tab.active{ color: var(--c-bg); background: var(--c-accent); }
.jtnq-cmp .fam-panel{ width: 100%; }
.jtnq-cmp .fam-caption{
  margin: 24px 0 16px; text-align: center;
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--c-text-mute);
}

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
  font-family: var(--f-serif); font-style: italic; font-size: 20px; color: var(--c-accent);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line));
  background: var(--c-bg-deep);
}
.jtnq-cmp .fc-body{ display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.jtnq-cmp .fc-name{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: 24px; line-height: 1.1; letter-spacing: -0.01em; color: var(--c-text);
}
.jtnq-cmp .fc-meta{
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--c-text-mute);
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
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-cmp .fc-from-v{ font-family: var(--f-mono); font-size: 20px; font-weight: 500; color: var(--c-text); }
.jtnq-cmp .fc-open{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-accent);
}
.jtnq-cmp .fc-chev{ width: 14px; height: 14px; transition: transform .2s ease; }
.jtnq-cmp .firm-card:hover .fc-chev{ transform: translate(2px, -2px); }

/* ── the window a firm's table opens in ── */
.jtnq-cmp .firm-dialog{
  position: fixed; inset: 0; margin: auto; padding: 48px 0 0; border: none; background: transparent; color: inherit;
  width: min(1120px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px);
  overflow-y: auto; overscroll-behavior: contain;
}
.jtnq-cmp .firm-dialog::backdrop{ background: oklch(0.07 0.02 165 / .8); backdrop-filter: blur(6px); }
.jtnq-cmp .firm-dialog .ft{ margin-top: 0; }
.jtnq-cmp .fd-close{
  position: absolute; top: 0; right: 0; width: 40px; height: 40px; display: grid; place-items: center;
  border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-raise); color: var(--c-text);
  cursor: pointer; transition: border-color .2s ease, color .2s ease;
}
.jtnq-cmp .fd-close:hover{ border-color: var(--c-accent); color: var(--c-accent); }
.jtnq-cmp .fd-close svg{ width: 18px; height: 18px; }
html:has(.firm-dialog[open]){ overflow: hidden; }

/* ── one firm's table ── */
@keyframes ft-in{ from{ opacity: 0; transform: translateY(8px); } to{ opacity: 1; transform: none; } }
.jtnq-cmp .ft{
  width: 100%; margin-top: 32px; border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-bg-raise);
  overflow: hidden; animation: ft-in .28s ease both;
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .35), 0 16px 40px -16px oklch(0.05 0.02 165 / .55);
}
@media (prefers-reduced-motion: reduce){ .jtnq-cmp .ft{ animation: none; } }
.jtnq-cmp .ft-head{
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 24px;
  padding: 24px; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-cmp .ft-id{ display: flex; align-items: center; gap: 16px; min-width: 0; }
.jtnq-cmp .ft-title{
  margin: 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(28px, 3.2vw, 40px); line-height: 1; letter-spacing: -0.02em; color: var(--c-text);
}
.jtnq-cmp .ft-sub{
  margin: 8px 0 0; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); line-height: 1.5;
}
.jtnq-cmp .ft-actions{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.jtnq-cmp .ft-actions .row-cta{ padding: 12px 20px; font-size: 14px; }

.jtnq-cmp .perps-promo{
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 0;
  padding: 12px 24px; border-bottom: 1px solid color-mix(in oklab, var(--c-accent) 35%, var(--c-line));
  background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 8%);
}
.jtnq-cmp .perps-promo-text{ font-size: 14px; color: var(--c-text); }
.jtnq-cmp .perps-clock{
  font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-weight: 500; color: var(--c-accent);
  white-space: nowrap;
}

.jtnq-cmp thead .ft-corner{ vertical-align: middle; text-align: left; }
.jtnq-cmp .ft-corner .ft-sec-title, .jtnq-cmp .ft-corner .ft-sec-sub{ position: static; display: block; }
.jtnq-cmp .ft-corner .ft-sec-sub{ margin-top: 4px; }
.jtnq-cmp .ft-flat{ min-width: max-content; }
.jtnq-cmp .ft-flat .ft-col--rule{
  font-family: var(--f-mono); font-style: normal; font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--c-text-mute); white-space: normal; min-width: 96px; max-width: 140px; line-height: 1.4;
}
.jtnq-cmp .ft-flat .ft-col--price{ min-width: 128px; }
.jtnq-cmp .ft-col-sub{ display: block; margin-top: 4px; font-family: var(--f-sans); font-size: 12px; font-style: italic; color: var(--c-text-mute); }
.jtnq-cmp .ft-flat .ft-acc{ position: sticky; left: 0; z-index: 1; min-width: 168px; text-align: left; }
.jtnq-cmp .ft-acc-prog{ display: block; font-family: var(--f-serif); font-style: italic; font-size: 15px; letter-spacing: 0; text-transform: none; color: var(--c-text); }
.jtnq-cmp .ft-acc-size{ display: block; margin-top: 4px; font-family: var(--f-mono); font-size: 13px; color: var(--c-accent); }
.jtnq-cmp .ft-flat .ft-cell{ white-space: nowrap; }
.jtnq-cmp .ft-flat .ft-cell--note{ white-space: normal; min-width: 200px; }
.jtnq-cmp .ft-flat tr.ft-newprog > *{ border-top: 1px solid var(--c-line); }
.jtnq-cmp .ft-bar{
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 24px; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-cmp .ft-progs, .jtnq-cmp .ft-mode{
  display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px;
  border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-deep);
}
.jtnq-cmp .ft-prog, .jtnq-cmp .ft-mode-btn{
  font-family: var(--f-sans); font-size: 13px; font-weight: 500; color: var(--c-text-mute);
  background: none; border: none; border-radius: 999px; padding: 8px 16px; cursor: pointer;
  transition: color .2s ease, background .2s ease;
}
.jtnq-cmp .ft-mode-btn{ font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; }
.jtnq-cmp .ft-prog:hover, .jtnq-cmp .ft-mode-btn:hover{ color: var(--c-accent); }
.jtnq-cmp .ft-prog.active, .jtnq-cmp .ft-mode-btn.active{ color: var(--c-bg); background: var(--c-accent); }
.jtnq-cmp .ft-pills{
  list-style: none; margin: 0; padding: 16px 24px; display: flex; flex-wrap: wrap; gap: 8px 24px;
  border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-cmp .ft-pill{ display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--c-text); }
.jtnq-cmp .ft-pill .ft-check{ display: inline-block; margin: 0; width: 16px; height: 16px; }
.jtnq-cmp .ft-pill-k{ color: var(--c-text-soft); }
.jtnq-cmp .ft-pill-v{ font-weight: 500; color: var(--c-text); }
.jtnq-cmp .ft-empty{ margin: 0; padding: 24px; font-size: 14px; color: var(--c-text-mute); }
.jtnq-cmp .ft-sizes .ft-col--size{ font-family: var(--f-mono); font-style: normal; font-size: 15px; color: var(--c-accent); }
.jtnq-cmp .ft-sizes .ft-label{ white-space: nowrap; }
.jtnq-cmp .ft-sizes td, .jtnq-cmp .ft-sizes th{ padding-top: 12px; padding-bottom: 12px; }
.jtnq-cmp .ft-check{ display: block; width: 18px; height: 18px; margin: 0 auto; color: var(--c-accent); }
.jtnq-cmp .ft-common{ padding: 24px; border-bottom: 1px solid var(--c-line-soft); }
.jtnq-cmp .ft-k{
  margin: 0 0 16px; font-family: var(--f-mono); font-size: 11px; font-weight: 400; letter-spacing: .18em;
  text-transform: uppercase; color: var(--c-accent);
}
.jtnq-cmp .ft-common ul{
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 12px 24px;
}
.jtnq-cmp .ft-common li{ display: flex; align-items: flex-start; gap: 8px; font-size: 15px; line-height: 1.4; color: var(--c-text); }
.jtnq-cmp .ft-common li svg{ width: 16px; height: 16px; margin-top: 2px; flex-shrink: 0; color: var(--c-accent); }

.jtnq-cmp .ft-scroll{ overflow-x: auto; -webkit-overflow-scrolling: touch; }
.jtnq-cmp .ft-table{
  width: 100%; min-width: calc(200px + var(--cols) * 160px); border-collapse: separate; border-spacing: 0;
}
.jtnq-cmp .ft-table th, .jtnq-cmp .ft-table td{
  padding: 16px; border-bottom: 1px solid var(--c-line-soft); vertical-align: middle;
}
.jtnq-cmp .ft-table tr:last-child > *{ border-bottom: none; }
.jtnq-cmp .ft-table thead th{
  background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%);
  border-bottom: 1px solid var(--c-line);
}
.jtnq-cmp .ft-col{
  text-align: center; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: 20px; letter-spacing: -0.01em; color: var(--c-text);
}
/* Rule names stay in view while the programs scroll sideways on a phone. */
.jtnq-cmp .ft-label{
  position: sticky; left: 0; z-index: 1; width: 200px; text-align: left;
  background: var(--c-bg-raise); box-shadow: inset -1px 0 0 var(--c-line-soft);
  font-family: var(--f-mono); font-size: 11px; font-weight: 400; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-soft); line-height: 1.4;
}
.jtnq-cmp thead .ft-label{ background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%); }
.jtnq-cmp .ft-size{ font-size: 14px; letter-spacing: .06em; color: var(--c-text); font-weight: 500; }
.jtnq-cmp .ft-cell{ text-align: center; }
.jtnq-cmp .ft-cell .tag{ margin-left: 8px; }
.jtnq-cmp .ft-cell .ft-fig + .tag{ margin-left: 8px; }
.jtnq-cmp .ft-cell .tag:only-child{ margin-left: 0; }
.jtnq-cmp .ft-fig{ font-family: var(--f-mono); font-size: 15px; font-weight: 500; color: var(--c-text); }
.jtnq-cmp .ft-word{ font-family: var(--f-sans); font-size: 15px; font-weight: 500; color: var(--c-text); line-height: 1.4; }
.jtnq-cmp .ft-swipe{ display: none; }
.jtnq-cmp .ft-cell--note{ vertical-align: top; }
.jtnq-cmp .ft-sentence{
  display: block; max-width: 34ch; margin: 0 auto; text-align: left;
  font-family: var(--f-sans); font-size: 12px; font-style: italic; line-height: 1.5; color: var(--c-text-soft);
}
.jtnq-cmp .ft-sec-cell{
  text-align: left; background: color-mix(in oklab, var(--c-bg-raise) 75%, var(--c-bg-deep) 25%);
  border-top: 1px solid var(--c-line); border-bottom: 1px solid var(--c-line) !important;
}
/* The section title stays pinned left like the rule names. */
.jtnq-cmp .ft-sec-title, .jtnq-cmp .ft-sec-sub{ position: sticky; left: 16px; }
.jtnq-cmp .ft-sec-title{
  display: inline-block; font-family: var(--f-mono); font-size: 11px; font-weight: 400; letter-spacing: .18em;
  text-transform: uppercase; color: var(--c-accent); margin-right: 16px;
}
.jtnq-cmp .ft-sec-sub{
  display: inline-block; font-family: var(--f-sans); font-size: 12px; font-weight: 400; font-style: italic; color: var(--c-text-mute);
}
.jtnq-cmp .ft-price .price-was{ white-space: nowrap; }
.jtnq-cmp .ft-price{ display: inline-flex; align-items: baseline; justify-content: center; gap: 8px; flex-wrap: wrap; }
.jtnq-cmp .ft-now{ font-family: var(--f-mono); font-size: 17px; font-weight: 500; color: var(--c-text); }
.jtnq-cmp .price-was{ font-family: var(--f-mono); font-size: 12px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .price-sep{ font-family: var(--f-mono); font-size: 15px; color: var(--c-text-mute); }
.jtnq-cmp .price-from{ font-family: var(--f-mono); font-size: 11px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .per{ font-family: var(--f-mono); font-size: 11px; color: var(--c-text-mute); }
.jtnq-cmp .ft-lines{ display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 8px; }
.jtnq-cmp .ft-line{ font-family: var(--f-mono); font-size: 11px; color: var(--c-text-soft); line-height: 1.4; }
.jtnq-cmp .ft-line .ft-fig{ font-size: 11px; font-weight: 400; color: var(--c-text-soft); }
.jtnq-cmp .ft-line .none{ font-size: 11px; }
.jtnq-cmp .ft-line-k{ color: var(--c-text-mute); text-transform: uppercase; letter-spacing: .08em; font-size: 10px; }
.jtnq-cmp .ft-foot{ padding: 8px 24px 24px; border-top: 1px solid var(--c-line-soft); }
.jtnq-cmp .ft-foot .note{ margin-top: 16px; }

@media (max-width: 720px){
  .jtnq-cmp .ft-bar, .jtnq-cmp .ft-pills{ padding-left: 16px; padding-right: 16px; }
  .jtnq-cmp .ft-sizes .ft-label{ white-space: normal; min-width: 96px; max-width: 112px; }
  .jtnq-cmp .ft-sizes .ft-col-sub{ font-size: 11px; }
  .jtnq-cmp .fam-tab{ padding: 12px 16px; font-size: 11px; }
  .jtnq-cmp .firm-card{ padding: 16px; }
  .jtnq-cmp .ft{ margin-top: 24px; }
  .jtnq-cmp .ft-head, .jtnq-cmp .ft-common{ padding: 16px; }
  .jtnq-cmp .perps-promo{ padding: 12px 16px; }
  .jtnq-cmp .ft-actions{ width: 100%; }
  .jtnq-cmp .ft-actions .row-cta{ margin-left: auto; }
  .jtnq-cmp .ft-table{ min-width: calc(104px + var(--cols) * 152px); }
  .jtnq-cmp .ft-swipe{
    display: block; margin: 0; padding: 12px 16px 0;
    font-family: var(--f-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--c-text-mute);
  }
  .jtnq-cmp .ft-table th, .jtnq-cmp .ft-table td{ padding: 12px 8px; }
  .jtnq-cmp .ft-word{ font-size: 14px; }
  .jtnq-cmp .ft-label{ width: 104px; font-size: 10px; letter-spacing: .1em; padding-left: 16px !important; }
  .jtnq-cmp .ft-col{ font-size: 17px; }
  .jtnq-cmp .ft-foot{ padding: 8px 16px 16px; }
}
`;
