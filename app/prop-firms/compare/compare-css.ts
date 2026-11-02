// Styles of the comparator (ComparePanel.tsx). Tokens come from shared.tsx (.jtnq-cmp);
// the price, figure and tag classes it reuses live in family-css.ts / shared.tsx.
// Every row alike: no row, firm or column is coloured or put forward (Angelo, 01/11/2026).

export const COMPARE_CSS = `
.jtnq-cmp .cmp{
  /* Wider than the page column: 15 columns read better side by side. */
  width: min(1440px, calc(100vw - 2 * var(--pad-x)));
  margin: 32px 0 0 50%; translate: -50% 0;
  display: flex; flex-direction: column; gap: 16px;
}

.jtnq-cmp .cmp-top{ display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
.jtnq-cmp .cmp-fam{
  padding: 4px; border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-deep);
}
.jtnq-cmp .cmp-firm-chip{
  display: inline-flex; align-items: center; gap: 8px; padding: 4px 4px 4px 16px;
  border: 1px solid var(--c-line); border-radius: 999px; background: var(--c-bg-raise);
  font-size: 14px; font-weight: 500; color: var(--c-text);
}
.jtnq-cmp .cmp-firm-chip-k{
  font-family: var(--f-sans); font-size: 14px; font-weight: 400; color: var(--c-text-mute);
}
.jtnq-cmp .cmp-firm-chip-x{
  width: 32px; height: 32px; display: grid; place-items: center; border: none; border-radius: 999px;
  background: var(--c-bg-deep); color: var(--c-text-soft); cursor: pointer; transition: color .2s ease;
}
.jtnq-cmp .cmp-firm-chip-x:hover{ color: var(--c-accent); }
.jtnq-cmp .cmp-firm-chip-x svg{ width: 14px; height: 14px; }

.jtnq-cmp .cmp-filters-toggle{ display: none; }

.jtnq-cmp .cmp-filters{
  display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: 16px 24px;
  padding: 16px 24px; border: 1px solid var(--c-line-soft); border-radius: 12px; background: var(--c-bg-raise);
}
.jtnq-cmp .cmp-field{ display: flex; flex-direction: column; gap: 8px; }
.jtnq-cmp .cmp-field-k{
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
}
.jtnq-cmp .cmp-select, .jtnq-cmp .cmp-money{
  position: relative; display: inline-flex; align-items: center;
  height: 40px; border: 1px solid var(--c-line); border-radius: 4px; background: var(--c-bg-deep);
  transition: border-color .2s ease;
}
.jtnq-cmp .cmp-select:focus-within, .jtnq-cmp .cmp-money:focus-within{ border-color: var(--c-accent); }
.jtnq-cmp .cmp-select select, .jtnq-cmp .cmp-money input{
  appearance: none; -webkit-appearance: none; border: none; background: transparent; outline: none;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text); height: 100%;
}
.jtnq-cmp .cmp-select select{ padding: 0 40px 0 12px; min-width: 128px; cursor: pointer; }
.jtnq-cmp .cmp-select select option{ background: var(--c-bg-deep); color: var(--c-text); }
.jtnq-cmp .cmp-select::after{
  content: ""; position: absolute; right: 16px; top: 50%; width: 6px; height: 6px; margin-top: -4px;
  border-right: 1.5px solid var(--c-text-mute); border-bottom: 1.5px solid var(--c-text-mute);
  transform: rotate(45deg); pointer-events: none;
}
.jtnq-cmp .cmp-money{ padding-left: 12px; font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute); }
.jtnq-cmp .cmp-money input{ width: 96px; padding: 0 12px 0 4px; -moz-appearance: textfield; }
.jtnq-cmp .cmp-money input::placeholder{ color: var(--c-text-mute); }
.jtnq-cmp .cmp-money input::-webkit-inner-spin-button, .jtnq-cmp .cmp-money input::-webkit-outer-spin-button{ -webkit-appearance: none; margin: 0; }
.jtnq-cmp .cmp-sort-m{ display: none; }
/* Firm: several can be picked, so a list of boxes under a field drawn like the selects. */
.jtnq-cmp .cmp-multi{ position: relative; }
.jtnq-cmp .cmp-multi-sum{
  list-style: none; position: relative; display: flex; align-items: center; height: 40px; padding: 0 40px 0 12px; min-width: 160px;
  border: 1px solid var(--c-line); border-radius: 4px; background: var(--c-bg-deep); cursor: pointer;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text); white-space: nowrap; transition: border-color .2s ease;
}
.jtnq-cmp .cmp-multi-sum::-webkit-details-marker{ display: none; }
.jtnq-cmp .cmp-multi-sum::after{
  content: ""; position: absolute; right: 16px; top: 50%; width: 6px; height: 6px; margin-top: -4px;
  border-right: 1.5px solid var(--c-text-mute); border-bottom: 1.5px solid var(--c-text-mute);
  transform: rotate(45deg); pointer-events: none;
}
.jtnq-cmp .cmp-multi[open] .cmp-multi-sum, .jtnq-cmp .cmp-multi-sum:focus-visible{ border-color: var(--c-accent); outline: none; }
.jtnq-cmp .cmp-multi-list{ left: 0; right: auto; min-width: 100%; }

.jtnq-cmp .cmp-switch{
  display: inline-flex; align-items: center; gap: 12px; height: 40px; padding: 0 4px;
  border: none; background: none; cursor: pointer;
  font-family: var(--f-sans); font-size: 14px; font-weight: 500; color: var(--c-text-soft);
}
.jtnq-cmp .cmp-switch-track{
  position: relative; width: 36px; height: 20px; border-radius: 999px;
  border: 1px solid var(--c-line); background: var(--c-bg-deep); transition: background .2s ease, border-color .2s ease;
}
.jtnq-cmp .cmp-switch-knob{
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 999px;
  background: var(--c-text-mute); transition: transform .2s ease, background .2s ease;
}
.jtnq-cmp .cmp-switch[aria-checked="true"]{ color: var(--c-text); }
.jtnq-cmp .cmp-switch[aria-checked="true"] .cmp-switch-track{ background: var(--c-accent); border-color: var(--c-accent); }
.jtnq-cmp .cmp-switch[aria-checked="true"] .cmp-switch-knob{ transform: translateX(16px); background: var(--c-bg); }

.jtnq-cmp .cmp-custom{ position: relative; }
.jtnq-cmp .cmp-custom summary{
  list-style: none; display: inline-flex; align-items: center; height: 40px; padding: 0 16px; cursor: pointer;
  border: 1px solid var(--c-line); border-radius: 999px;
  font-family: var(--f-sans); font-size: 14px; font-weight: 500; color: var(--c-text-soft);
  transition: color .2s ease, border-color .2s ease;
}
.jtnq-cmp .cmp-custom summary::-webkit-details-marker{ display: none; }
.jtnq-cmp .cmp-custom summary:hover, .jtnq-cmp .cmp-custom[open] summary{ color: var(--c-accent); border-color: var(--c-accent); }
.jtnq-cmp .cmp-custom summary:focus-visible{ outline: 2px solid var(--c-accent); outline-offset: 3px; }
.jtnq-cmp .cmp-custom-list{
  position: absolute; z-index: 20; right: 0; top: calc(100% + 8px); margin: 0; min-width: 240px;
  display: grid; gap: 4px; padding: 12px; border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-bg-raise);
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .35), 0 16px 40px -16px oklch(0.05 0.02 165 / .6);
}
.jtnq-cmp .cmp-check{
  display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 4px; cursor: pointer;
  font-size: 14px; color: var(--c-text-soft);
}
.jtnq-cmp .cmp-check:hover{ background: var(--c-bg-deep); color: var(--c-text); }
.jtnq-cmp .cmp-check input{ width: 16px; height: 16px; margin: 0; accent-color: var(--c-accent); }

.jtnq-cmp .cmp-count{
  margin: 0; text-align: center;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
}
.jtnq-cmp .cmp-empty{
  display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 24px;
  border: 1px dashed var(--c-line); border-radius: 12px; text-align: center;
}
.jtnq-cmp .cmp-empty p{ margin: 0; font-family: var(--f-sans); font-size: 20px; color: var(--c-text-soft); }
.jtnq-cmp .cmp-empty .ft-prog{ border: 1px solid var(--c-line); }

/* ── the table ── */
.jtnq-cmp .cmp-scroll{
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-bg-raise);
  box-shadow: 0 1px 2px oklch(0.05 0.02 165 / .35), 0 16px 40px -16px oklch(0.05 0.02 165 / .55);
}
.jtnq-cmp .cmp-table{ width: 100%; border-collapse: separate; border-spacing: 0; }
.jtnq-cmp .cmp-table th, .jtnq-cmp .cmp-table td{
  padding: 12px 8px; border-bottom: 1px solid var(--c-line-soft); vertical-align: middle; text-align: center;
}
.jtnq-cmp .cmp-table tbody tr:last-child > *{ border-bottom: none; }
.jtnq-cmp .cmp-table tbody tr{ transition: background .15s ease; }
.jtnq-cmp .cmp-table tbody tr:hover > *{ background: color-mix(in oklab, var(--c-bg-raise) 96%, var(--c-text) 4%); }
.jtnq-cmp .cmp-table thead th{
  padding: 0; background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%);
  border-bottom: 1px solid var(--c-line); vertical-align: bottom;
}
.jtnq-cmp .cmp-sort{
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 100%; padding: 16px 8px 12px;
  border: none; background: none; cursor: pointer;
  font-family: var(--f-sans); font-size: 14px; font-weight: 400; line-height: 1.4;
  color: var(--c-text-soft); transition: color .2s ease;
}
.jtnq-cmp .cmp-sort:focus-visible{ outline-offset: -2px; }
.jtnq-cmp .cmp-left .cmp-sort{ justify-content: flex-start; padding-left: 16px; }
.jtnq-cmp .cmp-sort:hover, .jtnq-cmp [aria-sort] .cmp-sort{ color: var(--c-accent); }
.jtnq-cmp .cmp-sort-mark{ width: 8px; height: 12px; flex-shrink: 0; fill: currentColor; opacity: .35; }
.jtnq-cmp .cmp-sort-mark.on{ opacity: 1; }
.jtnq-cmp .cmp-left{ text-align: left !important; }

/* The firm stays in view while the columns scroll sideways. */
.jtnq-cmp .cmp-firm-col{
  position: sticky; left: 0; z-index: 2; min-width: 200px; max-width: 232px;
  box-shadow: inset -1px 0 0 var(--c-line-soft);
}
.jtnq-cmp tbody .cmp-firm-col{ background: var(--c-bg-raise); }
.jtnq-cmp thead .cmp-firm-col{ z-index: 3; }
.jtnq-cmp .cmp-firm{ padding-left: 16px !important; font-weight: 400; }
.jtnq-cmp .cmp-firm-in{ display: flex; align-items: flex-start; gap: 12px; }
.jtnq-cmp .cmp-firm-txt{ display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.jtnq-cmp .cmp-firm-name{ font-family: var(--f-sans); font-size: 15px; font-weight: 500; color: var(--c-text); line-height: 1.2; }
.jtnq-cmp .cmp-prog{
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute); line-height: 1.4;
}
.jtnq-cmp .cmp-firm-meta{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 4px; }
.jtnq-cmp .cmp-firm-meta .promo-chip{ padding: 2px 8px; cursor: help; }
.jtnq-cmp .cmp-firm-meta .cmp-note-d{ margin-top: 0; }

.jtnq-cmp .cmp-td{ white-space: nowrap; }
.jtnq-cmp .cmp-td .ft-fig, .jtnq-cmp .cmp-td .ft-word{ font-size: 13px; }
.jtnq-cmp .cmp-td .ft-word{ font-weight: 400; }
/* Every short value reads in the data face, so a column never mixes two fonts (« None / 40% », « 21% / — »). */
.jtnq-cmp .cmp-val .ft-word, .jtnq-cmp .cmp-val .none{ font-family: var(--f-sans); }
/* Sentences (a split that changes after 30 days, a payout rule) wrap instead of widening the table. */
.jtnq-cmp :is(.cmp-c-split, .cmp-c-minPayout, .cmp-c-maxPayout, .cmp-c-payoutFreq, .cmp-c-consistency, .cmp-c-contracts){
  white-space: normal; min-width: 96px; max-width: 160px;
}
.jtnq-cmp .cmp-val{ display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
.jtnq-cmp .cmp-long > *:first-child{
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; cursor: help;
}
/* A sentence reads in the body face, whatever it starts with. */
.jtnq-cmp .cmp-long .ft-fig, .jtnq-cmp .cmp-long .ft-word{ font-family: var(--f-sans); font-size: 12px; font-weight: 400; line-height: 1.45; }
.jtnq-cmp .cmp-note-d{ margin-top: 4px; font-size: 12px; color: var(--c-text-mute); }
.jtnq-cmp .cmp-note-d summary{
  cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute);
}
.jtnq-cmp .cmp-note-d summary::-webkit-details-marker{ display: none; }
.jtnq-cmp .cmp-note-d summary::after{ content: "+"; }
.jtnq-cmp .cmp-note-d[open] summary::after{ content: "−"; }
.jtnq-cmp .cmp-note-d summary:hover{ color: var(--c-accent); }
.jtnq-cmp .cmp-note-d p{
  margin: 8px 0 0; max-width: 32ch; white-space: normal; text-align: left;
  font-family: var(--f-sans); font-size: 12px; line-height: 1.5; color: var(--c-text-soft);
}
.jtnq-cmp .cmp-sub{ font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute); }
.jtnq-cmp .cmp-dash{ color: var(--c-text-deep); }
.jtnq-cmp .cmp-td .ft-price{ flex-wrap: nowrap; gap: 4px 8px; }
.jtnq-cmp .cmp-td .ft-now{ font-size: 15px; }
.jtnq-cmp .cmp-go{ padding-right: 16px !important; }

.jtnq-cmp .cmp-cards{ display: none; }

.jtnq-cmp .cmp-note{
  margin: 8px auto 0; max-width: 72ch; text-align: center;
  font-size: 12px; line-height: 1.7; color: var(--c-text-mute); text-wrap: pretty;
}

/* ── phone: one card per plan, filters folded ── */
@media (max-width: 760px){
  .jtnq-cmp .cmp{ width: 100%; margin-left: 0; translate: none; margin-top: 24px; }
  .jtnq-cmp .cmp-filters-toggle{
    display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; cursor: pointer;
    border: 1px solid var(--c-line); border-radius: 999px; background: none;
    font-family: var(--f-sans); font-size: 14px; font-weight: 500; color: var(--c-text-soft);
  }
  .jtnq-cmp .cmp-filters-toggle svg{ width: 16px; height: 16px; transition: transform .2s ease; }
  .jtnq-cmp .cmp-filters-toggle[aria-expanded="true"]{ color: var(--c-accent); border-color: var(--c-accent); }
  .jtnq-cmp .cmp-filters-toggle[aria-expanded="true"] svg{ transform: rotate(180deg); }
  .jtnq-cmp .cmp-filters{ display: none; padding: 16px; gap: 16px; align-items: stretch; flex-direction: column; }
  .jtnq-cmp .cmp-filters.open{ display: flex; }
  .jtnq-cmp .cmp-field{ display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: 12px; }
  .jtnq-cmp .cmp-select, .jtnq-cmp .cmp-money{ width: 100%; }
  .jtnq-cmp .cmp-select select{ width: 100%; min-width: 0; }
  .jtnq-cmp .cmp-money input{ flex: 1; width: auto; }
  .jtnq-cmp .cmp-sort-m{ display: grid; }
  .jtnq-cmp .cmp-switch{ padding: 0; }
  .jtnq-cmp .cmp-custom-list{ position: static; margin-top: 8px; box-shadow: none; }
  .jtnq-cmp .cmp-multi-sum{ min-width: 0; width: 100%; }
  .jtnq-cmp .cmp-multi-list{ min-width: 0; }
  /* The open list grows the row: the label stays by the field, not in the middle. */
  .jtnq-cmp .cmp-field:has(.cmp-multi) .cmp-field-k{ align-self: start; padding-top: 12px; }

  .jtnq-cmp .cmp-scroll{ display: none; }
  .jtnq-cmp .cmp-cards{ display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .jtnq-cmp .cmp-card{
    display: flex; flex-direction: column; gap: 12px; padding: 16px;
    border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-bg-raise);
  }
  .jtnq-cmp .cmp-card-head{ display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; }
  .jtnq-cmp .cmp-card-size{ font-family: var(--f-sans); font-size: 15px; font-weight: 500; color: var(--c-text); }
  .jtnq-cmp .cmp-card-price .ft-price{ justify-content: flex-start; }
  .jtnq-cmp .cmp-card-price .ft-now{ font-size: 20px; }
  .jtnq-cmp .cmp-card-dl{ margin: 0; display: grid; border-top: 1px solid var(--c-line-soft); }
  .jtnq-cmp .cmp-card-row{
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: center; gap: 12px;
    padding: 8px 0; border-bottom: 1px solid var(--c-line-soft);
  }
  .jtnq-cmp .cmp-card-row dt{
    font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute); line-height: 1.4;
  }
  .jtnq-cmp .cmp-card-row dd{ margin: 0; text-align: right; }
  .jtnq-cmp .cmp-card-row .cmp-val{ align-items: flex-end; }
  .jtnq-cmp .cmp-card-row .ft-fig, .jtnq-cmp .cmp-card-row .ft-word{ font-size: 14px; }
  .jtnq-cmp .cmp-card-row .ft-word{ font-weight: 400; }
  .jtnq-cmp .cmp-long > *:first-child{ display: inline; -webkit-line-clamp: none; cursor: inherit; }
  .jtnq-cmp .cmp-card-row:has(.cmp-long){ grid-template-columns: 1fr; gap: 4px; }
  .jtnq-cmp .cmp-card-row:has(.cmp-long) dd{ text-align: left; }
  .jtnq-cmp .cmp-card-row .cmp-long{ align-items: flex-start; }
  .jtnq-cmp .cmp-card .cmp-note-d p{ max-width: none; }
  .jtnq-cmp .cmp-card-foot{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .jtnq-cmp .cmp-card-foot .row-cta{ margin-left: auto; }
}
`;
