// The versions of a perps plan sold with different daily loss limits, each with its own price
// (Angelo, 04/11/2026: buttons on the comparator's plans, idea seen on fredvshapes.com/prop-firms).
// Only what the firm publishes: MFP Elite (« None / 3% », price then altPrice) and Vest 1-Step
// (priceLabel + more). Pure: app/prop-firms/perps.ts uses it, scripts/daily-loss-choices.test.mjs
// checks it against the shipped data.

// « 3% DLL » → « 3% », « No DLL » → « None », the comparator's word for a rule the firm does not have.
const word = (label) => (/^no\b/i.test(label) ? 'None' : label.replace(/\s*DLL$/i, ''));

/**
 * @param {{ dailyLoss?: string | null; priceLabel?: string }} program
 * @param {{ price: number | null; promoPrice?: number | null; altPrice?: number; altPromoPrice?: number; more?: { label: string; price: number; promoPrice: number | null; altPrice?: number; altPromoPrice?: number }[] }} plan
 * @returns {{ label: string; price: number; promoPrice: number | null; altPrice?: number; altPromoPrice?: number }[] | null}
 *   null: one version only, the cell keeps its text.
 */
export function dailyLossChoices(program, plan) {
  if (plan.price == null) return null;
  if (plan.more?.length && program.priceLabel) {
    const { price, promoPrice = null, altPrice, altPromoPrice } = plan;
    return [
      { label: word(program.priceLabel), price, promoPrice, altPrice, altPromoPrice },
      ...plan.more.map((m) => ({ ...m, label: word(m.label) })),
    ];
  }
  const two = /^(.+?)\s*\/\s*(.+)$/.exec(program.dailyLoss ?? '');
  if (two && plan.altPrice != null) {
    return [
      { label: two[1], price: plan.price, promoPrice: plan.promoPrice ?? null },
      { label: two[2], price: plan.altPrice, promoPrice: plan.altPromoPrice ?? null },
    ];
  }
  return null;
}
