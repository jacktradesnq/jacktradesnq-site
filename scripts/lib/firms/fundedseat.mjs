/**
 * FundedSeat, lu sur son propre backend : GET /api/pullchallenges.
 *
 * Public, sans authentification, un tableau d'une trentaine de lignes (28 le
 * 2026-09-13). Pourquoi cette source et pas le dataset du site : le dataset ne
 * connait que 3 programmes (Daily, Sprint, Instant Funding) alors que leur API
 * en vend 7 familles. Le plan « Ultra » manquait a la tournee du matin, Angelo
 * l'a vu. Ici, la liste des produits vient de chez eux, chaque matin.
 *
 * Trois pieges, tous rencontres sur les vraies donnees :
 *
 *  - LES NOMS SE RESSEMBLENT. « 1 Step Daily (35%) - 50K » a $104.95 et
 *    « 1 Step Daily Ultra (35%) - 50K » a $197.50 sont deux produits
 *    differents. Une lecture par sous-chaine (« Daily », « Instant Funding »)
 *    publie le prix de l'un pour l'autre. On decoupe donc le nom EXACT en
 *    famille + taille, et rien d'autre ne fait foi.
 *
 *  - LE MEME NOM EST ACTIF PLUSIEURS FOIS, A DES PRIX DIFFERENTS.
 *    « 1 Step Daily Ultra (35%) - 100K » existe a $264.50, $297.50 et $451.50
 *    en meme temps. Il n'y a aucun « premier resultat » defendable : on garde
 *    TOUTES les variantes, on affiche la moins chere, et le plan porte
 *    `priceAmbiguous` pour que le message le dise au lieu de choisir en silence.
 *
 *  - `dailyloss` a la racine est la limite du compte FINANCE, pas celle du
 *    challenge (Sprint 50K : racine 1000, challenge 1200). La valeur du
 *    challenge est dans `steps[order = 1]` ; pour un Instant (steps_count 1),
 *    ce meme step est deja le step finance.
 *
 * Et la regle qui tient tout : un champ `null` dans cette API veut dire « cet
 * endpoint n'encode pas cette regle », pas « il n'y a pas de regle ». Une cle
 * absente ne produit aucune affirmation en aval ; un `null` explicite, si. On
 * OMET donc la cle partout, sauf `maxpayout` (voir plus bas).
 */

export const FUNDEDSEAT_API = 'https://fundedseat.com/api/pullchallenges';

/** La source citee dans l'en-tete Discord quand la tournee lit cette API. */
export const FUNDEDSEAT_SOURCE = 'API fundedseat.com/api/pullchallenges';

/**
 * L'ordre d'affichage, du plus vendu au plus marginal. Une famille inconnue de
 * cette liste n'est pas jetee : elle passe a la fin, dans l'ordre de l'API. Un
 * nouveau produit doit se voir, pas disparaitre.
 */
export const FAMILY_ORDER = [
  'Daily',
  'Daily Max',
  'Daily Ultra (35%)',
  'Daily Ultra (25%)',
  'Sprint',
  'Instant Funding Direct',
  'Instant Funding Bolt',
];

/**
 * Le meme User-Agent navigateur que le reste de la tournee de prix
 * (scripts/scrape-prop-firms.mjs). Un front qui se met a filtrer les clients
 * sans en-tete couterait une tournee, et cet en-tete ne coute rien.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Le nom EXACT decoupe en famille + taille.
 *
 *   « 1 Step Daily Ultra (35%) - 50K » -> { family: 'Daily Ultra (35%)', size: 50000 }
 *   « Instant Funding Bolt - 100K »    -> { family: 'Instant Funding Bolt', size: 100000 }
 *                                         (leur nom porte une espace finale)
 *   « 1 Step Sprint »                  -> { family: 'Sprint', size: null }
 *
 * Le « (35%) » de « 1 Step Daily (35%) » tombe : leur catalogue n'a qu'un seul
 * Daily de base, et le dataset du site l'appelle « Daily ». Sur les Ultra il
 * reste, parce que la (35%) et la (25%) sont deux produits qui coexistent.
 * Si un jour ils ajoutaient « 1 Step Daily (25%) », deux noms differents
 * tomberaient dans la famille « Daily » : `programsFrom` le detecte et refuse
 * de melanger, plutot que de publier un prix pour l'autre.
 */
export function parseFamily(name) {
  const raw = String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!raw) return { family: null, size: null };

  const stripped = raw.replace(/^1 Step /i, '');
  const withSize = stripped.match(/^(.*?) *- *(\d+) *K$/i);
  const family = (withSize ? withSize[1] : stripped).trim();
  const size = withSize ? Number(withSize[2]) * 1000 : null;

  return { family: family === 'Daily (35%)' ? 'Daily' : family, size };
}

/** Le step du challenge : order 1. Sur un Instant, c'est deja le step finance. */
const challengeStep = (row) => (row.steps ?? []).find((s) => s?.order === 1) ?? {};

/**
 * EOD + trailing = « EOD Trailing », la formulation que le reste de l'outil
 * connait. On ne promet « trailing » que si un seuil trailing est bien la.
 */
function ddTypeOf(row, challenge) {
  const mode = typeof row.drawdown_mode === 'string' ? row.drawdown_mode.trim() : '';
  if (!mode) return null;
  const trailing = num(row.Trailing_treshold) != null || num(challenge.Trailing_Max_Drawdown) != null;
  return trailing ? `${mode} Trailing` : mode;
}

/** Le plan a la forme du dataset du site, pour que rien en aval ne change. */
function planFrom(rows) {
  const [ref, ...autres] = rows;
  const challenge = challengeStep(ref);
  const plan = {};

  /** Une cle n'existe que si le fait existe. `null` ne se publie pas. */
  const claim = (key, value) => {
    if (value != null) plan[key] = value;
  };

  claim('size', num(ref.account_size));
  claim('price', num(ref.price));
  claim('originalPrice', num(ref.full_price));
  claim('profitTarget', num(ref.profit_goal));
  claim('maxDrawdown', num(ref.Trailing_treshold));
  claim('ddType', ddTypeOf(ref, challenge));
  claim('dailyLoss', num(challenge.dailyloss));
  claim(
    'consistency',
    num(challenge.consistency_percentage) == null ? null : `${challenge.consistency_percentage}%`,
  );
  // « 1 minis » se lit sur une page publique : le pluriel suit le nombre.
  claim(
    'contracts',
    num(ref.contracts) == null ? null : `${ref.contracts} mini${ref.contracts > 1 ? 's' : ''}`,
  );

  // La seule exception a la regle « pas de null » : sur les Ultra, `maxpayout`
  // est null la ou Daily et Daily Max annoncent 1000 / 2500. Face a des voisins
  // chiffres, ce vide se lit « pas de plafond », et c'est un argument de vente
  // reel. On l'expose donc explicitement, et factsLine le dit en toutes lettres.
  plan.maxPayout = num(ref.maxpayout);
  claim('minPayout', num(ref.Minimumpayout));
  claim('resetFee', num(ref.Reset_Fee));

  if (autres.length) {
    plan.priceAmbiguous = true;
    plan.variants = rows.map((r) => ({ price: num(r.price), originalPrice: num(r.full_price), id: r.id }));
  }

  return plan;
}

/**
 * Les programmes vendus, dans la forme du dataset.
 *
 * @param {unknown} payload  le corps de /api/pullchallenges, deja parse
 * @returns {Array<{name: string, type: 'eval'|'instant', priceType: 'one-time', plans: object[]}>}
 * @throws  quand le tableau est inutilisable, quand un nom contredit
 *          `account_size`, ou quand deux noms differents tombent dans la meme
 *          famille : dans ces trois cas, se taire vaut mieux qu'un faux prix.
 */
export function programsFrom(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('pullchallenges : tableau vide ou inattendu');
  }

  const groups = new Map();
  for (const row of payload) {
    if (!row || row.active !== true) continue;

    const nom = String(row.name ?? '').trim().replace(/\s+/g, ' ');
    const { family, size: sizeDuNom } = parseFamily(nom);
    const size = sizeDuNom ?? num(row.account_size);
    if (!family || size == null) continue;
    if (sizeDuNom != null && num(row.account_size) != null && sizeDuNom !== num(row.account_size)) {
      throw new Error(
        `"${nom}" annonce ${sizeDuNom} dans son nom et ${row.account_size} dans account_size : ` +
          'leur nommage a change, le mapping doit etre relu avant de publier un prix',
      );
    }

    const key = `${family}|${size}`;
    const group = groups.get(key) ?? { family, size, nom, type: row.account_type, rows: [] };
    if (group.nom !== nom) {
      throw new Error(
        `"${nom}" et "${group.nom}" tombent tous les deux dans la famille "${family}" : ` +
          'ce sont deux produits, refus de les melanger',
      );
    }
    group.rows.push(row);
    groups.set(key, group);
  }

  // Un meme nom vendu deux fois : « 1 Step Daily Ultra (35%) - 50K » existe AVEC
  // un daily loss de 1 200 $ (197,50 $) et SANS (307,50 $, ce que la page Ultra
  // vend : « Daily Loss Limit: None »). Ce sont deux produits, pas un prix
  // ambigu : on les separe, la variante avec daily loss prend un suffixe.
  const WITH_DLL = ' (with daily loss limit)';
  for (const [key, group] of [...groups.entries()]) {
    if (group.rows.length < 2) continue;
    const dll = (r) => num(((r.steps ?? []).find((s) => s.order === 1) ?? {}).dailyloss) != null;
    const avec = group.rows.filter(dll);
    const sans = group.rows.filter((r) => !dll(r));
    if (!avec.length || !sans.length) continue;
    groups.set(key, { ...group, rows: sans });
    const family = group.family + WITH_DLL;
    groups.set(`${family}|${group.size}`, { ...group, family, rows: avec });
  }

  const rank = (f) => {
    const base = f.endsWith(WITH_DLL) ? f.slice(0, -WITH_DLL.length) : f;
    const i = FAMILY_ORDER.indexOf(base);
    return (i < 0 ? FAMILY_ORDER.length : i) + (f.endsWith(WITH_DLL) ? 0.5 : 0);
  };
  const familles = [...new Set([...groups.values()].map((g) => g.family))].sort((a, b) => rank(a) - rank(b));
  familles.sort((a, b) => {
    const ia = rank(a);
    const ib = rank(b);
    return (ia < 0 ? FAMILY_ORDER.length : ia) - (ib < 0 ? FAMILY_ORDER.length : ib);
  });

  return familles.map((family) => {
    const groupes = [...groups.values()]
      .filter((g) => g.family === family)
      .sort((a, b) => a.size - b.size);
    return {
      name: family,
      type: groupes[0].type === 'Instant' ? 'instant' : 'eval',
      priceType: 'one-time',
      // Le prix montre est le MOINS CHER des actifs a ce nom : la variante
      // qu'un acheteur trouvera de lui-meme. Les autres restent dans `variants`.
      plans: groupes.map((g) => planFrom([...g.rows].sort((a, b) => (num(a.price) ?? 0) - (num(b.price) ?? 0)))),
    };
  });
}

/**
 * Telecharge et parse. Toute erreur est parlante : l'appelant (bin/matin.mjs)
 * la journalise et retombe sur le dataset du site, il ne l'avale pas.
 */
export async function fetchFundedSeatPrograms({ fetchImpl = fetch, url = FUNDEDSEAT_API } = {}) {
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

  const programs = programsFrom(payload);
  if (!programs.length) throw new Error(`${url} : aucun challenge actif`);
  return programs;
}
