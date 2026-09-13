/**
 * Blue Guardian, marche FUTURES, lu sur https://blueguardian.com/futures.
 *
 * Le site est un Next.js App Router : la page ne contient aucun JSON simple,
 * les donnees de prix arrivent en React Server Components streames inline
 * dans le HTML, sous la forme d'appels `self.__next_f.push([1, "<chaine>"])`.
 * Chaque chaine est un fragment `"<id hexa>:<JSON ou arbre React>"` ; les
 * produits (Standard, Reserve, Express, Direct, et les produits CFD hors
 * scope) vivent dans un objet `{ ..., plans: [...] }` retrouve par recherche
 * en profondeur dans ces fragments plutot que par un id de chunk fixe, qui
 * peut changer a chaque build du site (audit du 2026-09-13).
 *
 * Chaque plan porte `market` ('futures' | 'cfd' | 'fast_track' | ...) : on ne
 * garde que 'futures'. Un plan a `hasChallengeRules: true` pour Standard,
 * Reserve et Express (des evaluations) et `false` pour Direct (finance
 * d'emblee, "Skip the eval. No shortcuts after."). Chaque taille (`sizes[]`)
 * porte ses regles dans `challengeRules` (phase eval) OU, quand ce tableau
 * est vide (compte instant), dans `fundedRules` (le seul jeu de regles qui
 * existe alors) : on prend le premier non vide.
 *
 * Les regles sont une liste `{ label, value, ... }` en texte libre cote site
 * ("$$1,500", "None", "$$1,000 soft breach", "40%"...) : `ruleRaw` retrouve
 * la valeur brute d'un libelle donne, `undefined` si ce libelle n'existe pas
 * du tout pour ce plan (cle omise en sortie), `moneyOrNull` la convertit en
 * nombre, avec "None" -> `null` explicite (regle confirmee absente, pas
 * inconnue). Le texte "soft breach" est le seul signal fiable d'une limite de
 * perte journaliere souple : Express et Reserve ne le portent pas sur ce
 * relevé, Standard oui sur 50/100/150K.
 *
 * Un compte Direct n'a pas de phase d'evaluation (hasChallengeRules: false) :
 * l'absence de "Profit Target" dans ses regles n'est pas une inconnue, c'est
 * ce que dit ce booleen, d'ou un `profitTarget: null` explicite plutot qu'une
 * cle omise. Sa "Consistency Rule" n'existe pas non plus en tant que valeur
 * unique (le funded rules porte 3 paliers distincts, 1st/2nd/3rd+ Payout
 * Consistency) : on omet `consistency` plutot que de fabriquer un resume.
 */

export const BLUE_GUARDIAN_URL = 'https://blueguardian.com/futures';

/** La source citee dans l'en-tete Discord quand la tournee lit cette page. */
export const BLUE_GUARDIAN_SOURCE = 'page blueguardian.com/futures';

/**
 * Le meme User-Agent navigateur que le reste de la tournee de prix
 * (scripts/scrape-prop-firms.mjs). Un front qui se met a filtrer les clients
 * sans en-tete couterait une tournee, et cet en-tete ne coute rien.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const PUSH_CALL = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;

/** Decode chaque appel `self.__next_f.push([1,"..."])` en la chaine JS qu'il contient. */
function extractPushChunks(html) {
  const out = [];
  for (const m of String(html ?? '').matchAll(PUSH_CALL)) {
    try {
      out.push(JSON.parse(`"${m[1]}"`));
    } catch {
      // fragment illisible (echappement inattendu) : on l'ignore, pas de casse
    }
  }
  return out;
}

/** Un fragment RSC est `"<id hexa>:<payload>"` ; le payload n'est pas toujours du JSON pur. */
function parsePayload(chunk) {
  const m = /^[0-9a-f]+:(.*)$/s.exec(chunk);
  if (!m) return undefined;
  try {
    return JSON.parse(m[1]);
  } catch {
    return undefined;
  }
}

function isFuturesPlanNode(node) {
  return (
    node != null &&
    typeof node === 'object' &&
    !Array.isArray(node) &&
    node.market === 'futures' &&
    typeof node.label === 'string' &&
    Array.isArray(node.sizes)
  );
}

/** Recherche en profondeur : peu importe ou React a range le tableau de plans. */
function collectFuturesPlans(node, out, seen) {
  if (node == null || typeof node !== 'object') return;
  if (seen.has(node)) return;
  seen.add(node);
  if (isFuturesPlanNode(node)) {
    out.push(node);
    return;
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const v of values) collectFuturesPlans(v, out, seen);
}

function extractFuturesPlans(html) {
  const plans = [];
  const seenIds = new Set();
  for (const chunk of extractPushChunks(html)) {
    const data = parsePayload(chunk);
    if (data === undefined) continue;
    const found = [];
    collectFuturesPlans(data, found, new Set());
    for (const plan of found) {
      if (seenIds.has(plan.id)) continue; // le meme fragment peut etre pousse deux fois
      seenIds.add(plan.id);
      plans.push(plan);
    }
  }
  return plans;
}

/** La valeur brute d'un libelle de regle, `undefined` si ce libelle n'existe pas pour ce plan. */
function ruleRaw(rules, label) {
  const found = (rules ?? []).find((r) => r && r.label === label);
  return found ? found.value : undefined;
}

/** "$$1,500" -> 1500 ; "None" -> null (regle confirmee absente) ; introuvable -> undefined. */
function moneyOrNull(raw) {
  if (raw === undefined) return undefined;
  const digits = String(raw).replace(/[^0-9.]/g, '');
  return digits ? Number(digits) : null;
}

function planFromSize(sz, isEval) {
  const rules = sz.challengeRules?.length ? sz.challengeRules : (sz.fundedRules ?? []);
  const plan = { size: sz.amount, price: sz.currentPrice };

  if (sz.originalPrice != null) plan.originalPrice = sz.originalPrice;

  // Direct n'a pas de phase d'evaluation (hasChallengeRules: false) : l'absence
  // de "Profit Target" est ce fait-la, pas une inconnue. Explicite, jamais omis.
  plan.profitTarget = isEval ? (moneyOrNull(ruleRaw(rules, 'Profit Target')) ?? null) : null;

  const maxDrawdown = moneyOrNull(ruleRaw(rules, 'Max Drawdown'));
  if (maxDrawdown !== undefined) plan.maxDrawdown = maxDrawdown;

  const ddType = ruleRaw(rules, 'Drawdown Type');
  if (ddType !== undefined) plan.ddType = ddType;

  const dllRaw = ruleRaw(rules, 'Daily Loss Limit');
  if (dllRaw !== undefined) {
    plan.dailyLoss = moneyOrNull(dllRaw);
    plan.dailyLossSoft = /soft breach/i.test(dllRaw);
  }

  const consistency = ruleRaw(rules, 'Consistency Rule');
  if (consistency !== undefined) plan.consistency = consistency;

  const contracts = ruleRaw(rules, 'Max Position');
  if (contracts !== undefined) plan.contracts = contracts;

  return plan;
}

function programFromPlan(plan) {
  const isEval = plan.hasChallengeRules === true;
  const sizes = [...plan.sizes].sort((a, b) => a.amount - b.amount);
  return {
    name: plan.label,
    type: isEval ? 'eval' : 'instant',
    priceType: 'one-time',
    plans: sizes.map((sz) => planFromSize(sz, isEval)),
  };
}

/**
 * Les programmes FUTURES vendus, dans la forme du dataset.
 *
 * @param {string} html  la page blueguardian.com/futures
 * @throws  quand le payload RSC ne contient plus aucun produit `market:
 *          "futures"` (page changee de structure) : se taire vaut mieux
 *          qu'un catalogue invente.
 */
export function programsFromHtml(html) {
  const plans = extractFuturesPlans(html);
  if (!plans.length) {
    throw new Error(
      'blueguardian.com/futures : aucun produit "market":"futures" dans le payload RSC, la page a change',
    );
  }
  return plans.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(programFromPlan);
}

/**
 * Telecharge et parse. Toute erreur est parlante : l'appelant (bin/matin.mjs)
 * la journalise et retombe sur le dataset du site, il ne l'avale pas.
 */
export async function fetchBlueGuardianPrograms({ fetchImpl = fetch, url = BLUE_GUARDIAN_URL } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { headers: { 'user-agent': UA } });
  } catch (err) {
    throw new Error(`${url} injoignable : ${err.message}`);
  }
  if (!res?.ok) throw new Error(`${url} : HTTP ${res?.status ?? '?'}`);

  let html;
  try {
    html = await res.text();
  } catch (err) {
    throw new Error(`${url} : reponse illisible (${err.message})`);
  }

  return programsFromHtml(html);
}
