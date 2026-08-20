// Styles for /promos/. Appended after the shared CSS, so it inherits the
// tokens, the fonts and the hero from app/prop-firms/shared.tsx and only adds
// the card grid. Same contract: OKLCH, 4pt spacing, radius 4/12/999, one gold
// accent, Fraunces italic display, JetBrains Mono for labels.
export const PROMOS_CSS = `
.jtnq-cmp .promo-section{
  max-width: var(--maxw); margin: 0 auto;
  padding: 0 var(--pad-x) clamp(48px, 6vw, 80px);
}

.jtnq-cmp .promo-bar{
  display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  flex-wrap: wrap; padding-bottom: 16px; margin-bottom: 24px;
  border-bottom: 1px solid var(--c-line);
}
.jtnq-cmp .promo-count{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--c-text-mute);
}
.jtnq-cmp .promo-all{
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 14px; color: var(--c-accent); transition: gap .2s ease;
}
.jtnq-cmp .promo-all svg{ width: 14px; height: 14px; }
.jtnq-cmp .promo-all:hover{ gap: 12px; }

.jtnq-cmp .promo-grid{
  display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}

.jtnq-cmp .promo-card{
  display: flex; flex-direction: column; gap: 20px;
  padding: 24px; background: var(--c-bg-raise);
  border: 1px solid var(--c-line); border-radius: 12px;
  transition: border-color .25s ease, transform .25s ease;
}
.jtnq-cmp .promo-card:hover{ border-color: var(--c-accent); transform: translateY(-2px); }
/* The one expiring promo is the only thing on the page allowed to shout. */
.jtnq-cmp .promo-card.is-urgent{ border-color: oklch(0.52 0.09 45); }

/* One link per firm: /promos#legends-trading lands on their card and marks it,
   so a post can point at one deal instead of the whole page. */
.jtnq-cmp .promo-card{ scroll-margin-top: 24px; }
.jtnq-cmp .promo-card:target{
  border-color: var(--c-accent);
  box-shadow: 0 0 0 1px var(--c-accent), 0 24px 48px oklch(0.13 0.028 165 / 0.6);
}

.jtnq-cmp .promo-head{ display: flex; align-items: flex-start; gap: 12px; }
.jtnq-cmp .promo-logo{
  width: 40px; height: 40px; border-radius: 4px; flex: 0 0 auto; object-fit: contain;
}
.jtnq-cmp .promo-id{ flex: 1 1 auto; min-width: 0; }
.jtnq-cmp .promo-firm{
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: 22px; line-height: 1.15; letter-spacing: -0.01em; color: var(--c-text);
}
.jtnq-cmp .promo-plan{
  margin-top: 4px; font-size: 13px; color: var(--c-text-mute);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.jtnq-cmp .promo-kind{
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--c-text-deep); border: 1px solid var(--c-line); border-radius: 999px; padding: 2px 8px;
}
.jtnq-cmp .promo-ends{
  flex: 0 0 auto; font-family: var(--f-mono); font-size: 10px; letter-spacing: .12em;
  text-transform: uppercase; color: oklch(0.72 0.11 45);
  border: 1px solid oklch(0.42 0.07 45); border-radius: 999px; padding: 4px 10px;
}

.jtnq-cmp .promo-price{ display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.jtnq-cmp .promo-now{
  font-family: var(--f-serif); font-size: 36px; line-height: 1; letter-spacing: -0.02em;
  color: var(--c-accent);
}
.jtnq-cmp .promo-per{ font-family: var(--f-sans); font-size: 15px; letter-spacing: 0; }
.jtnq-cmp .promo-was{ font-size: 16px; color: var(--c-text-deep); }
.jtnq-cmp .promo-off{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-bg); background: var(--c-accent); border-radius: 999px; padding: 4px 10px;
}

/* A precision under the price, not a catch: LEGENDS' 50K Elite is $49 on a
   first order and $98 after, and hiding that would be lying by omission. */
.jtnq-cmp .promo-note{
  margin-top: -4px; font-size: 13px; line-height: 1.5; color: var(--c-text-mute);
}

.jtnq-cmp .promo-specs{
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px;
  padding-top: 20px; border-top: 1px solid var(--c-line-soft);
}
.jtnq-cmp .promo-specs dt{
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-deep);
}
.jtnq-cmp .promo-specs dd{ margin-top: 4px; font-size: 14px; color: var(--c-text-soft); }

.jtnq-cmp .promo-foot{
  margin-top: auto; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
.jtnq-cmp .promo-cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-size: 15px; font-weight: 700;
  color: var(--c-bg); background: var(--c-accent);
  border-radius: 999px; padding: 12px 24px;
  transition: transform .18s ease;
}
.jtnq-cmp .promo-cta svg{ width: 14px; height: 14px; }
.jtnq-cmp .promo-cta:hover{ transform: translateY(-1px); }
.jtnq-cmp .promo-code{
  font-family: var(--f-mono); font-size: 12px; letter-spacing: .08em; color: var(--c-text-mute);
}
.jtnq-cmp .promo-code strong{ color: var(--c-accent); }
.jtnq-cmp .promo-code--link{ text-transform: none; letter-spacing: 0; font-family: var(--f-sans); font-size: 13px; }

.jtnq-cmp .promo-section .note{ margin-top: 32px; }

@media (max-width: 720px){
  .jtnq-cmp .promo-grid{ grid-template-columns: minmax(0, 1fr); }
  .jtnq-cmp .promo-card{ padding: 20px; }
  .jtnq-cmp .promo-now{ font-size: 32px; }
  .jtnq-cmp .promo-cta{ width: 100%; justify-content: center; }
}
`;
