/**
 * Legends Trading, lu sur son API boutique publique : GET /shop/plans.
 *
 * Sans authentification, 68 lignes le 2026-09-13. Une seule colonne dit ce qui
 * est en vente : `isPublic: true`. Elle suffit a elle seule a ecarter aussi
 * bien un produit cache (« Straight to Master ») qu'une etape post-reussite
 * non achetable (« Master ») : pas besoin de les nommer, ni l'un ni l'autre
 * n'est jamais public. Le 2026-09-13, `isPublic: true` ne rend QUE Apprentice
 * (3 tailles, 50/100/150K) et Elite (4 tailles, 25/50/100/150K).
 *
 * L'API ne donne aucun champ structure pour les regles (target, drawdown,
 * daily loss, consistance, contrats, activation fee) : tout est dans le texte
 * libre `description` / `shortDescription`. On parse ce texte ; une regle que
 * le texte ne mentionne pas est OMISE (inconnue), une regle que le texte dit
 * explicitement « None » est mise a `null` (confirmee absente) — jamais
 * l'inverse. Concretement : Apprentice ne mentionne jamais de daily loss (cle
 * omise), Elite dit « Daily Loss Limit: None » (null explicite).
 *
 * Piege trouve sur les vraies donnees : le champ API `price` EST le prix
 * PLEIN catalogue, et `strikeThroughPrice` EST le prix deja remise sous le
 * coupon `activeCoupon` (« LTG ») que l'API applique elle-meme — les noms sont
 * contre-intuitifs. Ce prix remise correspond exactement au prix que publie
 * deja le dataset du site (35.4 pour l'Apprentice 50K, 83.3 pour l'Elite 25K,
 * etc.) : on le reprend tel quel comme `price`, et le prix plein de l'API
 * devient `originalPrice`. Le lire a l'envers ferait remonter un prix
 * 40 a 70% trop cher.
 *
 * Chaque taille existe en double dans l'API (Rithmic + Tradovate), au meme
 * prix : on garde la premiere ligne vue et on refuse de choisir en silence si
 * une paire venait a donner deux prix differents.
 */

export const LEGENDS_API = 'https://api.thelegendstrading.com/shop/plans';

/** La source citee dans l'en-tete Discord quand la tournee lit cette API. */
export const LEGENDS_SOURCE = 'API api.thelegendstrading.com/shop/plans';

/**
 * Le meme User-Agent navigateur que le reste de la tournee de prix
 * (scripts/scrape-prop-firms.mjs). Un front qui se met a filtrer les clients
 * sans en-tete couterait une tournee, et cet en-tete ne coute rien.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** « $50,000 » ou « $25,000 Elite » -> 50000 / 25000. */
function sizeFrom(row) {
  const raw = row.storeDisplayName ?? row.dashboardDisplayName ?? '';
  const m = String(raw).match(/([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** Les regles d'un plan, lues dans le texte libre description/shortDescription. */
function rulesFrom(row) {
  const desc = String(row.description ?? '');
  const short = String(row.shortDescription ?? '');
  const rules = {};

  const target = desc.match(/\$([\d,]+)\s*profit goal/i) || desc.match(/\$([\d,]+)\s*Profit Target/i);
  if (target) rules.profitTarget = Number(target[1].replace(/,/g, ''));

  const dd = desc.match(/\$([\d,]+)\s*EOD\s*trailing\s*max\s*loss/i);
  if (dd) {
    rules.maxDrawdown = Number(dd[1].replace(/,/g, ''));
    rules.ddType = 'EOD Trailing';
  }

  if (/Daily Loss Limit:\s*None/i.test(desc)) rules.dailyLoss = null;

  if (/No consistency required/i.test(desc)) rules.consistency = 'None';
  else {
    const cons = desc.match(/Consistency:\s*([\d.]+%)/i);
    if (cons) rules.consistency = cons[1];
  }

  const contracts = short.match(/Max\s+(\d+)\s+(?:contracts|minis)\s*\/\s*(\d+)\s+micros/i);
  if (contracts) rules.contracts = `${contracts[1]} minis / ${contracts[2]} micros`;

  const fee = desc.match(/\$(\d+(?:\.\d+)?)\s*Activation Fee/i);
  if (fee) rules.activationFee = Number(fee[1]);
  else if (/Activation Fee:\s*None/i.test(desc)) rules.activationFee = null;

  return rules;
}

/** Le plan a la forme du dataset du site : prix remise en `price`, prix catalogue en `originalPrice`. */
function planFrom(row) {
  const plan = { size: sizeFrom(row) };
  const full = num(row.price);
  const discounted = num(row.strikeThroughPrice);
  if (discounted != null && discounted !== full) {
    plan.price = discounted;
    plan.originalPrice = full;
  } else {
    plan.price = full;
  }
  return { ...plan, ...rulesFrom(row) };
}

/**
 * Les programmes publics (Apprentice, Elite), dans la forme du dataset.
 *
 * @param {unknown} payload  le corps de /shop/plans, deja parse (`{ data: [...] }`)
 * @returns {Array<{name: string, type: 'eval'|'instant', priceType: 'one-time'|'monthly', plans: object[]}>}
 * @throws  quand Apprentice ou Elite ne sont plus tous les deux publics, quand
 *          une taille est illisible, ou quand deux lignes de la meme case
 *          (categorie+taille) donnent des prix differents : se taire vaut
 *          mieux qu'un faux prix.
 */
export function programsFrom(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : null;
  if (!rows || rows.length === 0) throw new Error('shop/plans : payload.data absent ou vide');

  const categories = new Map(); // productCategory -> { sortIndex, sizes: Map<size, row> }

  for (const row of rows) {
    if (!row || row.isPublic !== true) continue;
    const category = row.productCategory;
    if (category !== 'Apprentice' && category !== 'Elite') continue; // aucune autre categorie n'est publique le 2026-09-13

    const size = sizeFrom(row);
    if (size == null) {
      throw new Error(`"${row.dashboardDisplayName}" (${category}) : taille illisible dans storeDisplayName`);
    }

    const cat = categories.get(category) ?? { sortIndex: row.productCategorySortIndex ?? 0, sizes: new Map() };
    const existing = cat.sizes.get(size);
    if (existing) {
      if (num(existing.price) !== num(row.price) || num(existing.strikeThroughPrice) !== num(row.strikeThroughPrice)) {
        throw new Error(
          `${category} ${size} : deux lignes publiques a des prix differents (${existing.price} vs ${row.price}), ` +
            'refus de choisir en silence',
        );
      }
    } else {
      cat.sizes.set(size, row);
    }
    categories.set(category, cat);
  }

  if (!categories.has('Apprentice') || !categories.has('Elite')) {
    throw new Error(
      'shop/plans ne rend plus Apprentice et Elite publics tous les deux ' +
        `(trouve : ${[...categories.keys()].join(', ') || 'aucun'})`,
    );
  }

  return [...categories.entries()]
    .sort((a, b) => a[1].sortIndex - b[1].sortIndex)
    .map(([category, cat]) => {
      const rowsOrdered = [...cat.sizes.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
      return {
        name: category,
        type: 'eval',
        priceType: rowsOrdered[0].isPriceRecurring ? 'monthly' : 'one-time',
        plans: rowsOrdered.map(planFrom),
      };
    });
}

/**
 * Telecharge et parse. Toute erreur est parlante : bin/matin.mjs la journalise
 * et retombe sur le dataset du site, il ne l'avale pas.
 */
export async function fetchLegendsPrograms({ fetchImpl = fetch, url = LEGENDS_API } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  } catch (err) {
    throw new Error(`${url} injoignable : ${err.message}`);
  }
  if (!res?.ok) throw new Error(`${url} : HTTP ${res?.status ?? '?'}`);

  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    throw new Error(`${url} : reponse illisible (${err.message})`);
  }

  return programsFrom(payload);
}
