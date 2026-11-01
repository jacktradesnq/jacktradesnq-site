// When a firm's promo with an end date stops showing on the site.
// Pure (no React, no data): app/prop-firms/promo-clock.ts runs the clock, futures.ts and
// perps.ts judge each promo with it, scripts/promo-ends.test.mjs checks it.
//
// A non-partner firm of the comparator (public/data/compare-extra-firms.json) whose public
// code has passed its promo.ends shows neither the code nor the discounted prices: list
// price (originalPrice), nothing struck through, until scripts/scrape-tradeify.mjs reads the
// next code on their site (Angelo, 01/11/2026 : « quand c'est expiré check tous les jours
// jusqu'à ce qu'il y ait le bon code »).

/**
 * @param {string | number | null | undefined} ends  ISO date, or ms since epoch
 * @returns {number | null}
 */
export function endMs(ends) {
  if (ends == null || ends === '') return null;
  const ms = typeof ends === 'number' ? ends : Date.parse(ends);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Does a promo still run at `at`? No end date (or one that does not parse): always.
 * @param {string | number | null | undefined} ends
 * @param {number} at  ms since epoch
 */
export function runsAt(ends, at) {
  const ms = endMs(ends);
  return ms == null || at < ms;
}

/**
 * The firm as the comparator shows it at `at`: unchanged while its promo runs; once
 * promo.ends has passed, no promo, no code, every plan at its list price.
 * @template {{ promo?: { ends?: string } | null; code?: string | null; programs: { promoCode?: string; promoLabel?: string; plans: { price: number; originalPrice?: number | null }[] }[] }} F
 * @param {F} firm
 * @param {number} at
 * @returns {F}
 */
export function firmAt(firm, at) {
  if (runsAt(firm.promo?.ends, at)) return firm;
  return {
    ...firm,
    promo: null,
    code: null,
    programs: firm.programs.map(({ promoCode, promoLabel, ...pr }) => ({
      ...pr,
      plans: pr.plans.map((pl) => ({ ...pl, price: pl.originalPrice ?? pl.price, originalPrice: null })),
    })),
  };
}

/**
 * Every promo end of a list of firms, in ms, for the clock to wake up at.
 * @param {{ promo?: { ends?: string } | null }[]} firms
 * @returns {number[]}
 */
export function promoEnds(firms) {
  return firms.flatMap((f) => {
    const ms = endMs(f.promo?.ends);
    return ms == null ? [] : [ms];
  });
}
