/**
 * MyFundedPerps (perps), lu sur leur page d'accueil https://myfundedperpetuals.com/ (le lien
 * affilié myfundedperpetuals.com/@JTNQ sert la même page : canonical « / », mêmes données ; un
 * curl nu y prend un 403 Cloudflare, « / » passe).
 *
 * Le site est une app TanStack Start : le HTML embarque, dans un script « $_TSR.router=… »
 * (format seroval, du JS littéral), les requêtes Convex que la page a faites côté serveur :
 *
 *   queryKey ["convexQuery", "challengeTiers:listPublic", {}]          les comptes en vente, un par taille
 *       { key: "select-10K", modelKey: "select", planKey: "select", startingBalance: 10000,
 *         feeCents: 4000, profitTargetPct: 9, maxDrawdownPct: 3, maxDrawdownType: "static",
 *         maxDailyLossPct: 3, profitSplitPct: 80, ... }
 *   ["convexQuery", "challengeTiers:listModelsPublic", {}]             les programmes et leur nom affiché
 *   ["convexQuery", "discountCodesRead:getStandingDiscountPromotion"]  la remise de tous les jours
 *   ["convexQuery", "discountCodesRead:getHomepageDiscountOffer"]      le code que l'accueil met en avant
 *   ["convexQuery", "discountCodesRead:get<Évènement>Offer"]           une offre datée (Black Friday…)
 *   ["convexQuery", "affiliateConfig:getPublicCustomerDiscountPercent"] la remise d'un code affilié
 *   ["convexQuery", "promotionsRead:getActivePromoSurfaces"]           pastilles et bannières par plan
 *
 * On lit ces données (pas le texte), puis on recoupe avec ce que la page a rendu : chaque carte
 * de prix (« List Price: $49 USD » barré, « Sale Price: $29 USD », « Save $30 ») doit retomber
 * sur un compte de la liste avec leur règle d'arrondi. Un écart = page changée = erreur.
 *
 * Remise : ce que leur barre promo affiche quand le code JTNQ est sélectionné (lien /@JTNQ),
 * relu dans leur code client le 28/11/2026 (composant de la barre, chunk c_dc5d936e) :
 *   - une offre datée active (Black Friday…) passe sous le code de l'affilié : « 40% off your
 *     first purchase (35% after) » ;
 *   - sinon « Use code JTNQ for {1er achat}% off your first purchase — {taux}% off every
 *     purchase after. », taux = affiliateConfig:getPublicCustomerDiscountPercent, 1er achat = le
 *     plus grand des taux 1er achat de la remise de tous les jours et du code de l'accueil, montré
 *     seulement s'il dépasse le taux ; sinon « {taux}% off all accounts ».
 * Le taux propre d'un affilié ne se lit qu'en validant le code au checkout
 * (discountCodes.validateCheckoutCode) : jamais fait ici.
 *
 * Arrondi (leur fonction, chunk c_2710c457) : prix remisé = Math.round(centimes × (100 − %) / 100),
 * puis, si le prix catalogue est un nombre rond de dollars, ramené au dollar inférieur :
 * 190 $ à −35 % = 123,50 → 123 ; 595 $ à −35 % = 386,75 → 386.
 *
 * Le code imprimé est TOUJOURS JTNQ ; le code public de la firme est lu dans le HTML pour rien,
 * jamais rendu par ce module.
 *
 * Elite est vendu en deux versions par taille (planKey « elite » sans daily loss, « elite-dll »
 * à 3 %) : un seul programme « Elite / Elite 3% DLL », price = sans DLL, altPrice = 3 % DLL
 * (Angelo, 12/10/2026 : « dans la même colonne et dans chaque truc t'as un / qui met les 2 prix »).
 * Un autre programme vendu en plusieurs versions arrête la lecture : comment le caser est à
 * trancher par Angelo. Un programme nouveau à une seule version entre seul, sous le nom que leur
 * site lui donne (customerName) ; un programme qu'ils ne vendent plus sort seul (Angelo, 28/11).
 *
 * note et rulesKey ne sont pas sur leur page : repris du JSON actuel (option previous) pour un
 * programme du même nom, absents sinon.
 */
import { fetchPageText } from '../cf-fetch.mjs';

export const MFP_PERPS_SOURCE = 'https://myfundedperpetuals.com/';
export const MFP_CODE = 'JTNQ';

const MAX_PRICE = 5000; // dollars ; leur compte le plus cher est à 959 $ le 28/11/2026
const DD_TYPES = { static: 'Static', trailing_eod: 'Trailing EOD' }; // libellés de leur carte
const PAIRED_MODELS = new Set(['elite']); // programmes vendus en deux versions, sans / avec DLL

const fail = (why) => {
  throw new Error(`MyFundedPerps illisible : ${why}`);
};

/**
 * Lit la page. Rend le snapshot brut que la fixture garde : { url, fetchedAt, html }.
 * fetchText(url) -> texte (défaut : fetch, puis curl_cffi sur 403 / 429 / 503). chromium : inutile
 * ici (les données sont dans le HTML), accepté pour la forme commune des lecteurs.
 */
export async function readMfpPerps({ fetchText = (url) => fetchPageText(url), chromium } = {}) {
  void chromium;
  const html = await fetchText(MFP_PERPS_SOURCE);
  return { url: MFP_PERPS_SOURCE, fetchedAt: new Date().toISOString(), html };
}

// ---------------------------------------------------------------------------------------------
// Lecture du format seroval : objets, tableaux, chaînes, nombres, !0 / !1, void 0, null,
// $R[n]=valeur (déclaration) et $R[n] (renvoi). Tout le reste (fonction, new Date…) lève.

function serovalValue(src, start) {
  const refs = new Map();
  let i = start;
  const err = (what) => {
    throw new Error(`${what} à la position ${i} (« ${src.slice(i, i + 40)} »)`);
  };
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const string = () => {
    const q = src[i++];
    let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] !== '\\') {
        out += src[i++];
        continue;
      }
      const e = src[i + 1];
      i += 2;
      if (e === 'x') {
        out += String.fromCharCode(parseInt(src.slice(i, i + 2), 16));
        i += 2;
      } else if (e === 'u' && src[i] === '{') {
        const end = src.indexOf('}', i);
        out += String.fromCodePoint(parseInt(src.slice(i + 1, end), 16));
        i = end + 1;
      } else if (e === 'u') {
        out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16));
        i += 4;
      } else out += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[e] ?? e;
    }
    if (src[i] !== q) err('chaîne non fermée');
    i++;
    return out;
  };
  const value = (id) => {
    ws();
    if (src.startsWith('$R[', i)) {
      const m = /^\$R\[(\d+)\]/.exec(src.slice(i, i + 24));
      if (!m) err('renvoi $R illisible');
      i += m[0].length;
      const n = Number(m[1]);
      if (src[i] === '=' && src[i + 1] !== '=') {
        i++;
        const v = value(n);
        refs.set(n, v);
        return v;
      }
      if (!refs.has(n)) err(`renvoi $R[${n}] sans déclaration`);
      return refs.get(n);
    }
    const c = src[i];
    if (c === '{') {
      const obj = {};
      if (id != null) refs.set(id, obj);
      i++;
      ws();
      if (src[i] === '}') {
        i++;
        return obj;
      }
      for (;;) {
        ws();
        let key;
        if (src[i] === '"' || src[i] === "'") key = string();
        else {
          const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i, i + 200));
          if (!m) err('clé illisible');
          key = m[0];
          i += key.length;
        }
        ws();
        if (src[i] !== ':') err('« : » attendu');
        i++;
        obj[key] = value();
        ws();
        if (src[i] === ',') {
          i++;
          continue;
        }
        if (src[i] === '}') {
          i++;
          return obj;
        }
        err('« , » ou « } » attendu');
      }
    }
    if (c === '[') {
      const arr = [];
      if (id != null) refs.set(id, arr);
      i++;
      ws();
      if (src[i] === ']') {
        i++;
        return arr;
      }
      for (;;) {
        ws();
        arr.push(src[i] === ',' ? undefined : value());
        ws();
        if (src[i] === ',') {
          i++;
          continue;
        }
        if (src[i] === ']') {
          i++;
          return arr;
        }
        err('« , » ou « ] » attendu');
      }
    }
    if (c === '"' || c === "'") return string();
    for (const [word, v] of [
      ['!0', true],
      ['!1', false],
      ['void 0', undefined],
      ['null', null],
      ['true', true],
      ['false', false],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
    ]) {
      if (src.startsWith(word, i) && !/[\w$]/.test(src[i + word.length] ?? '')) {
        i += word.length;
        return v;
      }
    }
    const num = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i, i + 40));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    return err('valeur non prise en charge');
  };
  return value();
}

const dollars = (s) => Number(String(s).replace(/,/g, ''));

/**
 * Ce que la page porte : { renderedAt, steps, queries, cards }.
 *   queries : { 'challengeTiers:listPublic': data, ... } (les requêtes Convex réussies) ;
 *   cards   : les cartes de prix rendues, [{ list, price, save, comingSoon }] en dollars ;
 *   steps   : « 1 step » d'après le titre « 1-Step Challenges ».
 */
export function mfpPageData(html) {
  if (typeof html !== 'string' || html.length === 0) fail('page vide');
  if (/<title>(?:Attention Required!|Just a moment\.\.\.)/.test(html)) fail('page de blocage Cloudflare au lieu de leur accueil');
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const router = scripts.find((s) => s.includes('dehydratedData:'));
  if (!router) fail('données de la page (dehydratedData) introuvables');
  const at = router.indexOf('initial:', router.indexOf('dehydratedData:'));
  if (at === -1) fail('liste des requêtes (query.initial) introuvable');
  let initial;
  try {
    initial = serovalValue(router, at + 'initial:'.length);
  } catch (e) {
    fail(`données de la page non lisibles : ${e.message}`);
  }
  if (!Array.isArray(initial)) fail('query.initial n\'est pas une liste');
  const queries = {};
  for (const q of initial) {
    const name = Array.isArray(q?.queryKey) && q.queryKey[0] === 'convexQuery' ? q.queryKey[1] : null;
    if (typeof name === 'string' && q.state?.status === 'success') queries[name] = q.state.data;
  }
  const renderedAt = Number(router.match(/renderedAt:(\d{12,})/)?.[1]);
  if (!Number.isFinite(renderedAt)) fail('heure de rendu (renderedAt) introuvable');

  const heads = [...new Set([...html.matchAll(/>(\d+)-Step Challenges</g)].map((m) => Number(m[1])))];
  const steps = heads.length === 1 ? `${heads[0]} step${heads[0] > 1 ? 's' : ''}` : null;

  // Une carte par « landing-challenge-card-stage » (le prix est dans son premier
  // « landing-challenge-print », la taille dans le second, « Save $N » plus bas).
  const cards = html
    .split('landing-challenge-card-stage')
    .slice(1)
    .map((part) => {
      if (/class="landing-challenge-print[^"]*"[^>]*>Coming Soon</.test(part)) return { comingSoon: true };
      const list = part.match(/<s class="landing-challenge-was[^"]*"><span class="sr-only">List Price: \$([\d,]+(?:\.\d+)?) USD<\/span>/)?.[1];
      const price = part.match(/<p class="landing-challenge-price[^"]*"[^>]*><span class="sr-only">(?:Sale Price: )?\$([\d,]+(?:\.\d+)?) USD<\/span>/)?.[1];
      const save = part.match(/>Save \$([\d,]+(?:\.\d+)?)</)?.[1];
      return {
        list: list == null ? null : dollars(list),
        price: price == null ? null : dollars(price),
        save: save == null ? null : dollars(save),
      };
    });
  return { renderedAt, steps, queries, cards };
}

// ---------------------------------------------------------------------------------------------

/** Leur prix remisé, en dollars (voir l'en-tête) : 190, 35 -> 123 ; 87, 40 -> 52. */
export function mfpDiscounted(price, pct) {
  const cents = Math.round(price * 100);
  const n = Math.round((cents * (100 - pct)) / 100);
  return (cents % 100 === 0 && n >= 100 ? Math.floor(n / 100) * 100 : n) / 100;
}

const isPct = (v, { zero = false } = {}) => typeof v === 'number' && Number.isFinite(v) && (zero ? v >= 0 : v > 0) && v < 100;
const runs = (offer, now, { openEnded }) =>
  offer != null &&
  (offer.startsAt == null || now >= offer.startsAt) &&
  (offer.expiresAt == null ? openEnded : now < offer.expiresAt);

/** Les offres datées que la page porte (get…Offer, hors code de l'accueil) : [{ name, offer }]. */
function timedOffers(queries) {
  return Object.entries(queries)
    .filter(([name, data]) => /^discountCodesRead:get\w+Offer$/.test(name) && name !== 'discountCodesRead:getHomepageDiscountOffer' && data != null)
    .map(([name, offer]) => ({ name: name.split(':')[1], offer }));
}

/** Le taux qu'une offre datée affiche : { first, rate } (first null = un seul taux). */
function offerRates(name, offer) {
  if (!isPct(offer.discountPercent)) fail(`offre ${name} active sans taux lisible (remise par programme ?) : à relire à la main`);
  const fp = offer.firstPurchaseDiscountPercent;
  if (fp != null && !isPct(fp)) fail(`offre ${name} : taux 1er achat « ${fp} » illisible`);
  return { first: fp != null && fp > offer.discountPercent ? fp : null, rate: offer.discountPercent };
}

/**
 * La remise que leur barre promo montre sous le code JTNQ à l'instant `now` (voir l'en-tête),
 * dans la forme du JSON : { code, discountPct, endsAt, firstPurchase?, lastChecked, thenPct? } ou null.
 */
export function mfpJtnqPromo(queries, now, checkedOn) {
  const surfaces = queries['promotionsRead:getActivePromoSurfaces'];
  for (const kind of ['badges', 'banners']) {
    const live = (surfaces?.[kind] ?? []).filter((s) => runs(s, now, { openEnded: true }));
    if (live.length) fail(`${kind === 'badges' ? 'pastille' : 'bannière'} de promo active (${live.map((s) => s.promotionId ?? s.label ?? '?').join(', ')}) : remise par plan, à relire à la main`);
  }
  const candidates = [];
  for (const { name, offer } of timedOffers(queries)) {
    if (!runs(offer, now, { openEnded: false })) continue;
    candidates.push({ ...offerRates(name, offer), endsAt: new Date(offer.expiresAt).toISOString() });
  }
  // Sans offre datée : le taux d'un code affilié, et le taux 1er achat s'il est plus grand.
  const base = queries['affiliateConfig:getPublicCustomerDiscountPercent'];
  if (!isPct(base, { zero: true })) fail('taux des codes affiliés (getPublicCustomerDiscountPercent) introuvable');
  const firsts = [];
  const standing = queries['discountCodesRead:getStandingDiscountPromotion'];
  if (standing?.firstPurchaseDiscountPercent != null) firsts.push(standing.firstPurchaseDiscountPercent);
  const home = queries['discountCodesRead:getHomepageDiscountOffer'];
  if (runs(home, now, { openEnded: true }) && home.firstPurchaseDiscountPercent != null) firsts.push(home.firstPurchaseDiscountPercent);
  const first = firsts.length ? Math.max(...firsts) : null;
  candidates.push({ first: first != null && first > base ? first : null, rate: base, endsAt: null });

  const top = (c) => c.first ?? c.rate;
  const best = candidates.reduce((a, b) => (top(b) > top(a) || (top(b) === top(a) && b.rate > a.rate) ? b : a));
  if (top(best) <= 0) return null;
  return best.first != null
    ? { code: MFP_CODE, discountPct: best.first, endsAt: best.endsAt, firstPurchase: true, lastChecked: checkedOn, thenPct: best.rate }
    : { code: MFP_CODE, discountPct: best.rate, endsAt: best.endsAt, lastChecked: checkedOn };
}

/** Le taux des prix que la page affiche à tous (offre datée active, sinon remise de tous les jours). */
function pageRates(queries, now) {
  const rates = new Set([0]);
  const standing = queries['discountCodesRead:getStandingDiscountPromotion'];
  if (standing && isPct(standing.discountPercent, { zero: true })) {
    const fp = standing.firstPurchaseDiscountPercent;
    rates.add(fp != null && fp > standing.discountPercent ? fp : standing.discountPercent);
  }
  for (const { name, offer } of timedOffers(queries)) if (runs(offer, now, { openEnded: false })) rates.add(offerRates(name, offer).first ?? offer.discountPercent);
  return [...rates];
}

/** Un compte de listPublic vérifié : { model, plan, size, price, rules }. */
function tierOf(t) {
  const key = t?.key ?? '?';
  if (typeof t?.modelKey !== 'string' || typeof t.planKey !== 'string') fail(`compte ${key} sans programme`);
  if (!Number.isInteger(t.startingBalance) || t.startingBalance < 1000) fail(`compte ${key} sans taille lisible`);
  if (t.feeCents == null) fail(`compte ${key} sans prix`);
  if (!Number.isInteger(t.feeCents) || t.feeCents <= 0 || t.feeCents > MAX_PRICE * 100) fail(`compte ${key} : prix aberrant (${t.feeCents} centimes)`);
  if (!isPct(t.profitTargetPct)) fail(`compte ${key} : objectif « ${t.profitTargetPct} » illisible`);
  if (!isPct(t.maxDrawdownPct)) fail(`compte ${key} : drawdown « ${t.maxDrawdownPct} » illisible`);
  if (!(t.maxDrawdownType in DD_TYPES)) fail(`compte ${key} : type de drawdown « ${t.maxDrawdownType} » inconnu`);
  if (!isPct(t.maxDailyLossPct, { zero: true })) fail(`compte ${key} : daily loss « ${t.maxDailyLossPct} » illisible`);
  if (!(typeof t.profitSplitPct === 'number' && t.profitSplitPct > 0 && t.profitSplitPct <= 100)) fail(`compte ${key} : split « ${t.profitSplitPct} » illisible`);
  return {
    key,
    model: t.modelKey,
    plan: t.planKey,
    size: t.startingBalance,
    price: t.feeCents / 100,
    dll: t.maxDailyLossPct,
    rules: {
      split: `${t.profitSplitPct}%`,
      profitTarget: `${t.profitTargetPct}%`,
      maxDrawdown: `${t.maxDrawdownPct}%`,
      ddType: DD_TYPES[t.maxDrawdownType],
    },
  };
}

const sameRules = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Les règles communes à tous les comptes d'un groupe, ou une erreur. */
function commonRules(label, tiers) {
  const r = tiers[0].rules;
  const odd = tiers.find((t) => !sameRules(t.rules, r));
  if (odd) fail(`${label} : règles différentes selon la taille (${odd.key}), le JSON n'en porte qu'une par programme`);
  return r;
}

function bySize(label, tiers) {
  const map = new Map();
  for (const t of tiers) {
    if (map.has(t.size)) fail(`${label} : deux comptes à $${t.size / 1000}K (${map.get(t.size).key}, ${t.key})`);
    map.set(t.size, t);
  }
  return map;
}

/**
 * La page lue (mfpPageData) -> { programs, promo }, forme exacte de public/data/perps-firms.json.
 * Options : checkedOn (AAAA-MM-JJ, défaut : jour UTC du rendu), previous (la firme du JSON actuel,
 * ou sa liste de programmes) pour garder note et rulesKey.
 */
export function mfpPerpsFromPage(page, { checkedOn, previous } = {}) {
  const { queries, renderedAt: now } = page;
  const day = checkedOn ?? new Date(now).toISOString().slice(0, 10);
  const list = queries['challengeTiers:listPublic'];
  if (!Array.isArray(list)) fail('liste des comptes (challengeTiers:listPublic) introuvable');
  if (list.length === 0) fail('aucun plan en vente');
  const models = queries['challengeTiers:listModelsPublic'];
  if (!Array.isArray(models) || models.length === 0) fail('liste des programmes (challengeTiers:listModelsPublic) introuvable');
  if (!page.steps) fail('titre « N-Step Challenges » introuvable ou multiple');

  const tiers = list.map(tierOf);
  const promo = mfpJtnqPromo(queries, now, day);
  const promoOf = (price) => (promo ? mfpDiscounted(price, promo.discountPct) : null);
  const prevPrograms = Array.isArray(previous) ? previous : (previous?.programs ?? []);

  const programs = [];
  const seen = new Set();
  for (const m of models) {
    const mine = tiers.filter((t) => t.model === m?.key);
    seen.add(m?.key);
    if (mine.length === 0) continue; // programme listé mais rien en vente (Beta le 28/11/2026)
    const label = m.customerName ?? m.name;
    if (typeof label !== 'string' || !label.trim()) fail(`programme ${m.key} sans nom affiché`);
    const plans = [...new Set(mine.map((t) => t.plan))];
    let program;
    if (plans.length === 1) {
      const rules = commonRules(label, mine);
      const dll = [...new Set(mine.map((t) => t.dll))];
      if (dll.length !== 1) fail(`${label} : daily loss différente selon la taille`);
      program = {
        name: label,
        steps: page.steps,
        ...rules,
        dailyLoss: dll[0] > 0 ? `${dll[0]}%` : 'None',
        plans: [...bySize(label, mine).values()]
          .sort((a, b) => a.size - b.size)
          .map((t) => ({ size: t.size, price: t.price, promoPrice: promoOf(t.price) })),
      };
    } else if (PAIRED_MODELS.has(m.key) && plans.length === 2) {
      const none = mine.filter((t) => t.dll === 0);
      const withDll = mine.filter((t) => t.dll > 0);
      const pcts = [...new Set(withDll.map((t) => t.dll))];
      if (new Set(none.map((t) => t.plan)).size !== 1 || new Set(withDll.map((t) => t.plan)).size !== 1 || pcts.length !== 1)
        fail(`${label} : les deux versions ne sont plus « sans DLL » et « avec DLL » (${plans.join(', ')})`);
      const rules = commonRules(label, mine);
      const a = bySize(label, none);
      const b = bySize(label, withDll);
      const sizes = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y);
      const lone = sizes.find((s) => !a.has(s) || !b.has(s));
      if (lone) fail(`${label} $${lone / 1000}K : une seule des deux versions en vente`);
      program = {
        name: `${label} / ${label} ${pcts[0]}% DLL`,
        steps: page.steps,
        ...rules,
        dailyLoss: `None / ${pcts[0]}%`,
        plans: sizes.map((s) => ({
          size: s,
          price: a.get(s).price,
          promoPrice: promoOf(a.get(s).price),
          altPrice: b.get(s).price,
          altPromoPrice: promoOf(b.get(s).price),
        })),
      };
    } else {
      fail(`${label} vendu en ${plans.length} versions (${plans.join(', ')}) : comment le caser dans le JSON est à trancher`);
    }
    const prev = prevPrograms.find((p) => p.name === program.name);
    const { plans: planList, ...head } = program;
    programs.push({
      name: head.name,
      ...(prev?.rulesKey != null ? { rulesKey: prev.rulesKey } : {}),
      steps: head.steps,
      split: head.split,
      profitTarget: head.profitTarget,
      maxDrawdown: head.maxDrawdown,
      ddType: head.ddType,
      dailyLoss: head.dailyLoss,
      ...(prev?.note != null ? { note: prev.note } : {}),
      plans: planList,
    });
  }
  const orphan = tiers.find((t) => !seen.has(t.model));
  if (orphan) fail(`compte ${orphan.key} : programme « ${orphan.model} » absent de la liste des programmes (pas de nom affiché)`);

  // Recoupement avec les cartes rendues : prix catalogue, taux, arrondi, et l'écart « Save $N »
  // entre la version sans DLL et la version 3 % DLL.
  const fees = new Set(tiers.map((t) => t.price));
  const cards = page.cards.filter((c) => !c.comingSoon);
  if (cards.length === 0) fail('aucune carte de prix rendue sur la page');
  const fits = (r) =>
    cards.every((c) => {
      if (c.price == null) return false;
      if (r === 0 ? c.list != null || !fees.has(c.price) : c.list == null || !fees.has(c.list) || mfpDiscounted(c.list, r) !== c.price) return false;
      return c.save == null || tiers.some((t) => mfpDiscounted(t.price, r) === c.price + c.save);
    });
  if (!pageRates(queries, now).some(fits))
    fail(`les cartes rendues (${cards.map((c) => `${c.list ?? '-'}→${c.price ?? '?'}${c.save != null ? ` save ${c.save}` : ''}`).join(', ')}) ne retombent pas sur leurs données`);
  return { programs, promo };
}

/** Le snapshot de readMfpPerps -> { programs, promo } (mêmes options que mfpPerpsFromPage). */
export function mfpPerpsFromSnapshot(snapshot, options = {}) {
  return mfpPerpsFromPage(mfpPageData(snapshot?.html), options);
}
