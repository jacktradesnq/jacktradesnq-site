/**
 * TradeDay, lu sur sa page d'accueil : https://www.tradeday.com/
 *
 * Page Webflow, HTML statique rendu serveur (un `fetch` simple suffit, testé
 * le 2026-09-13 : 200 sans User-Agent particulier ; on en pose un de
 * navigateur quand meme, par prudence face a un futur filtre anti-bot).
 * Pourquoi cette source et pas le dataset du site : le dataset ne connaissait
 * que 50/100/150K, la taille 25K manquait partout (audit du 2026-09-13). Les
 * prix 50/100/150K lus ici collent exactement au dataset — aucun ecart, a
 * part cette taille absente.
 *
 * Structure de la page : chaque plan est une carte "flip" Webflow — une face
 * avant (`<div class="pricing-card_item">`, prix + regles d'evaluation) puis,
 * juste apres dans le HTML, son dos (`class="pricing-card_item is-flip"`,
 * regles du compte une fois finance). Chaque plan existe deux fois (Tradovate
 * et Rithmic) : on parse les deux occurrences et on VERIFIE qu'elles sont
 * identiques plutot que de supposer un ordre ou de n'en garder qu'une.
 *
 * Trois familles, mais seulement DEUX titres sur la face avant : "Intraday"
 * et "End of Day". Les deux "End of Day" ne se distinguent pas par leur titre
 * (identique) mais par leur consistency, un champ REEL affiche sur la carte
 * (pas une classe CSS Webflow, trop fragile) :
 *
 *  - Intraday (titre "Intraday", consistency 30%) -> "Quick Pay Intraday".
 *  - End of Day, consistency 30% -> "Quick Pay EOD". Le dos de la carte
 *    affiche alors "Consistency: None" : la regle ne vaut que pour
 *    l'evaluation, d'ou le "(eval only)" dans le champ publie.
 *  - End of Day, consistency 45% -> "Fast Pass". Le dos confirme
 *    "Consistency: 45%" : la regle reste une fois finance, pas de suffixe.
 *    Le dos donne aussi le nombre de contrats du compte finance (plus bas
 *    que celui de l'evaluation, avec un palier "+1 par $2k").
 *
 * Les noms de sortie ("Quick Pay Intraday", "Quick Pay EOD", "Fast Pass")
 * sont ceux du dataset existant, gardes pour que knowledge/tradeday.json
 * continue de s'apparier dessus.
 *
 * Aucune "daily loss" n'apparait nulle part sur la page (seul un drawdown
 * trailing existe) : la cle `dailyLoss` n'est jamais ecrite, plutot que d'y
 * mettre `null` comme le faisait le dataset — une absence sur la page ne vaut
 * pas une regle confirmee.
 */

const TRADEDAY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export const TRADEDAY_URL = 'https://www.tradeday.com/';

/** La source citee dans l'en-tete Discord quand la tournee lit cette page. */
export const TRADEDAY_SOURCE = 'page tradeday.com';

const FRONT_OPEN = '<div class="pricing-card_item">';
const FLIP_MARK = 'is-flip';

const NAME_BY_TITLE_AND_CONSISTENCY = {
  Intraday: { 30: 'Quick Pay Intraday' },
  'End of Day': { 30: 'Quick Pay EOD', 45: 'Fast Pass' },
};

/** L'ordre d'affichage, celui du dataset. */
const FAMILY_ORDER = ['Quick Pay Intraday', 'Quick Pay EOD', 'Fast Pass'];

const int = (v) => {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Toutes les paires `<p ...>texte</p>` d'un fragment, texte brut (non decode). */
function paragraphs(html) {
  return [...html.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map((m) => m[1].trim());
}

/**
 * Une carte (face + dos) -> son plan brut, ou lance si la carte ne ressemble
 * plus a ce qu'on connait (mieux vaut s'arreter que publier un faux prix).
 */
function parseCard(block, index) {
  const flipAt = block.indexOf(FLIP_MARK);
  if (flipAt < 0) {
    throw new Error(`carte pricing #${index} : pas de dos "is-flip", la page a change`);
  }
  const front = block.slice(0, flipAt);
  const back = block.slice(flipAt);

  const titleMatch = front.match(/<p[^>]*fs-list-field="drawdown"[^>]*>([^<]*)<\/p>/);
  if (!titleMatch) throw new Error(`carte pricing #${index} : titre introuvable`);
  const title = titleMatch[1].trim();

  const sizeMatch = front.match(/<p[^>]*class="[^"]*text-size-large[^"]*"[^>]*>([^<]*)<\/p>/);
  const sizeK = sizeMatch && sizeMatch[1].trim().match(/^(\d+)k$/i);
  if (!sizeK) throw new Error(`carte pricing #${index} ("${title}") : taille introuvable`);
  const size = Number(sizeK[1]) * 1000;

  const prices = [
    ...front.matchAll(/<div class="display-inline">\$<\/div><div class="display-inline">(\d+)<\/div>/g),
  ];
  if (prices.length !== 2) {
    throw new Error(`carte pricing #${index} ("${title}" ${size}) : ${prices.length} prix trouves au lieu de 2`);
  }
  const [originalPrice, price] = prices.map((m) => int(m[1]));

  let profitTarget = null;
  let maxDrawdown = null;
  let calcType = null;
  let evalContracts = null;
  let micros = null;
  let frontConsistency = null;
  for (const p of paragraphs(front)) {
    let m;
    if ((m = p.match(/^Profit Target \$([\d,]+)/))) profitTarget = int(m[1]);
    else if ((m = p.match(/^Trailing Max Drawdown \$([\d,]+) \(calculated ([^)]+)\)/))) {
      maxDrawdown = int(m[1]);
      calcType = m[2].trim();
    } else if ((m = p.match(/^Position Limits? - (\d+) Contracts? \((\d+) Micros?\)/i))) {
      evalContracts = int(m[1]);
      micros = int(m[2]);
    } else if ((m = p.match(/^Consistency ([\d.]+)%/))) frontConsistency = Number(m[1]);
  }
  if (profitTarget == null || maxDrawdown == null || !calcType || evalContracts == null || frontConsistency == null) {
    throw new Error(`carte pricing #${index} ("${title}" ${size}) : un champ attendu manque sur la face avant`);
  }

  const backFields = {};
  for (const p of paragraphs(back)) {
    const sep = p.indexOf(':');
    if (sep > 0) backFields[p.slice(0, sep).trim()] = p.slice(sep + 1).trim();
  }

  const familyByConsistency = NAME_BY_TITLE_AND_CONSISTENCY[title];
  const family = familyByConsistency && familyByConsistency[frontConsistency];
  if (!family) {
    throw new Error(
      `carte pricing #${index} : titre "${title}" avec consistency ${frontConsistency}% inconnu (page changee)`,
    );
  }

  let ddType;
  if (calcType === 'Intraday') ddType = 'Intraday';
  else if (calcType === 'End of Day') ddType = 'EOD Trailing';
  else throw new Error(`carte pricing #${index} ("${family}" ${size}) : type de drawdown inconnu "${calcType}"`);

  const backConsistency = backFields.Consistency;
  let consistency;
  if (backConsistency === 'None') {
    consistency = `${frontConsistency}% (eval only)`;
  } else {
    const backPct = int(backConsistency);
    if (backPct !== frontConsistency) {
      throw new Error(
        `carte pricing #${index} ("${family}" ${size}) : consistency face avant ${frontConsistency}% ` +
          `mais dos "${backConsistency}"`,
      );
    }
    consistency = `${frontConsistency}%`;
  }

  let contracts;
  if (family === 'Fast Pass') {
    const posLimit = backFields['Position Limit'];
    const fundedN = posLimit && posLimit.match(/^(\d+)/);
    if (!fundedN) {
      throw new Error(`carte pricing #${index} ("${family}" ${size}) : contrats du compte finance introuvables`);
    }
    contracts = `${evalContracts} contracts eval / ${fundedN[1]} funded, +1 per $2k`;
  } else {
    contracts = `${evalContracts} contracts (${micros} micros)`;
  }

  return { family, size, price, originalPrice, profitTarget, maxDrawdown, ddType, consistency, contracts };
}

/**
 * Les 3 programmes vendus, dans la forme du dataset.
 *
 * @param {string} html  la page tradeday.com telle que servie
 * @throws  quand les cartes pricing ne sont plus 3 familles x 4 tailles
 *          identiques sur les deux plateformes : se taire vaut mieux qu'un
 *          faux prix.
 */
export function programsFromHtml(html) {
  if (typeof html !== 'string' || !html.includes(FRONT_OPEN)) {
    throw new Error('tradeday.com : aucune carte pricing trouvee, la page a change');
  }

  const blocks = html.split(FRONT_OPEN).slice(1);
  const cards = blocks.map((b, i) => parseCard(b, i));

  const groups = new Map();
  for (const card of cards) {
    const key = `${card.family}|${card.size}`;
    const { family, size, ...plan } = card;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { family, size, plan });
    } else if (JSON.stringify(existing.plan) !== JSON.stringify(plan)) {
      throw new Error(
        `"${family}" ${size} : deux cartes (Tradovate/Rithmic) donnent des regles differentes, ` +
          `refus de choisir : ${JSON.stringify(existing.plan)} vs ${JSON.stringify(plan)}`,
      );
    }
  }

  const bySizeFamily = new Map();
  for (const { family, size, plan } of groups.values()) {
    if (!bySizeFamily.has(family)) bySizeFamily.set(family, new Map());
    bySizeFamily.get(family).set(size, plan);
  }

  const expectedSizes = [25000, 50000, 100000, 150000];
  const missing = [];
  for (const family of FAMILY_ORDER) {
    const sizes = bySizeFamily.get(family);
    if (!sizes) {
      missing.push(family);
      continue;
    }
    for (const size of expectedSizes) if (!sizes.has(size)) missing.push(`${family} ${size}`);
  }
  if (missing.length) {
    throw new Error(`tradeday.com : programmes/tailles manquants, la page a change (${missing.join(', ')})`);
  }

  return FAMILY_ORDER.map((family) => ({
    name: family,
    type: 'eval',
    priceType: 'monthly',
    plans: expectedSizes.map((size) => ({ size, ...bySizeFamily.get(family).get(size) })),
  }));
}

/**
 * Telecharge et parse. Toute erreur est parlante : l'appelant (bin/matin.mjs)
 * la journalise et retombe sur le dataset du site, il ne l'avale pas.
 */
export async function fetchTradeDayPrograms({ fetchImpl = fetch, url = TRADEDAY_URL } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { headers: { 'user-agent': TRADEDAY_UA } });
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
