// The discount a firm's card prints next to its code (Angelo, 04/11/2026: the % on each card,
// idea seen on fredvshapes.com/prop-firms). One format for every firm, none put forward.
// Pure: app/prop-firms/firm-view.ts and perps.ts use it, scripts/discount-words.test.mjs checks it.

/**
 * @param {(number | null | undefined)[]} pcts  every discount the firm gives, in percent
 * @returns {string | null}  « 20% off », « Up to 35% off » when they differ, null when none
 */
export function discountWords(pcts) {
  const known = pcts.filter((p) => typeof p === 'number' && p > 0).map((p) => Math.round(p));
  if (!known.length) return null;
  const top = Math.max(...known);
  return known.every((p) => p === top) ? `${top}% off` : `Up to ${top}% off`;
}
