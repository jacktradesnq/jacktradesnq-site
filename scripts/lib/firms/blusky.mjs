/**
 * BluSky (futures), lu sur l'API de leur checkout : la liste des produits que
 * trader.blusky.pro/checkout affiche, publique (pas de session), en JSON.
 *
 *   GET https://blusky-f.tradetechsolutions.app/checkout/list/products_v2/
 *   -> [{ challenge_type: "Launch", products: [{ name: "LAUNCH 50K",
 *          variants: [{ account_size: "50K", price: "59", broker: "Tradovate" }, ...] }] }, ...]
 *
 * Une variante par plateforme (Volumetrica, Tradovate, Rithmic...) : le prix est
 * le meme sur toutes le 2026-10-27. Des prix qui different d'une plateforme a
 * l'autre arretent la firme plutot que d'en choisir un.
 *
 * Chemin `updates` : seuls price / originalPrice bougent, les programmes et les
 * regles du JSON restent ecrits a la main (lus au checkout le 2026-10-27).
 */

export const BLUSKY_PRODUCTS_URL = 'https://blusky-f.tradetechsolutions.app/checkout/list/products_v2/';

/** challenge_type de l'API -> nom du programme dans public/data/prop-firms.json. */
export const BLUSKY_PROGRAMS = {
  Launch: 'Launch',
  PROPEL: 'Propel',
  ORBIT: 'Orbit',
  'Direct 2 Funded': 'Direct 2 Funded',
  'Instant Funded': 'Instant Funded',
};

// Ce que le code JTNQ retire, plan par plan : visuel « One code. Every BluSky plan »
// envoye par leur CM a Angelo le 2026-10-27 (« Launch $10 off, Propel 30% off, Orbit
// 30% off, Instant Funded $300 off — use code JTNQ »). Direct 2 Funded n'y est pas :
// prix catalogue. Le prix publie est celui paye avec JTNQ, le prix catalogue est barre.
export const JTNQ_OFF = {
  Launch: { usd: 10 },
  Propel: { pct: 30 },
  Orbit: { pct: 30 },
  'Instant Funded': { usd: 300 },
};

const withCode = (programName, list) => {
  const off = JTNQ_OFF[programName];
  if (!off) return { price: list, originalPrice: null };
  const price = off.usd != null ? list - off.usd : Math.round(list * (100 - off.pct)) / 100;
  return { price, originalPrice: list };
};

/** « 50K » -> 50000, « 3.5K » -> 3500. */
export function sizeOf(label) {
  const m = String(label).trim().match(/^([\d.]+)\s*K$/i);
  if (!m) throw new Error(`taille « ${label} » illisible`);
  return Math.round(parseFloat(m[1]) * 1000);
}

/** Le JSON de l'API -> [{ programName, size, price, originalPrice }]. */
export function plansFromProducts(list) {
  const plans = [];
  for (const group of list) {
    const programName = BLUSKY_PROGRAMS[group.challenge_type];
    // « No Type » = les frais de Launch (Activation Product), pas un compte a vendre.
    if (!programName) continue;
    for (const product of group.products) {
      const prices = new Set(product.variants.map((v) => Number(v.price)));
      if (prices.size !== 1) throw new Error(`${product.name}: prix differents selon la plateforme (${[...prices]})`);
      const sizes = new Set(product.variants.map((v) => sizeOf(v.account_size)));
      if (sizes.size !== 1) throw new Error(`${product.name}: plusieurs tailles dans un produit`);
      const listPrice = [...prices][0];
      if (!Number.isFinite(listPrice)) throw new Error(`${product.name}: prix illisible`);
      plans.push({ programName, size: [...sizes][0], ...withCode(programName, listPrice) });
    }
  }
  return plans;
}

export async function fetchBluSkyPlans(fetchImpl = fetch) {
  const res = await fetchImpl(BLUSKY_PRODUCTS_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${BLUSKY_PRODUCTS_URL}`);
  return plansFromProducts(await res.json());
}
