/**
 * BluSky (futures), lu sur deux pages de leur site.
 *
 * 1. Le CATALOGUE, sur l'API de leur checkout : la liste des produits que
 *    trader.blusky.pro/checkout affiche, publique (pas de session), en JSON.
 *
 *      GET https://blusky-f.tradetechsolutions.app/checkout/list/products_v2/
 *      -> [{ challenge_type: "Launch", products: [{ name: "LAUNCH 50K",
 *             variants: [{ account_size: "50K", price: "59", broker: "Tradovate",
 *                          has_subscription: true, ... }, ...],
 *             challenge: { steps, no_activation_fee, phases: [{ step: 1, target_profit_amount,
 *                          maximum_drawdown_amount, consistency, minis_limit, ... }] } }] }, ...]
 *
 *    Ce que l'API vend est le catalogue (chemin `{ programs }` de
 *    scripts/scrape-prop-firms.mjs) : un programme ou une taille qu'elle ajoute
 *    apparait sur le site, ce qu'elle ne vend plus en disparait (Angelo,
 *    21/10/2026 : « tant que y a sur leur site faut que ca sois sur nôtre site
 *    aussi » ; 28/11/2026 : « un plan que la firme ajoute n'apparaît pas tout
 *    seul sur le site. pourquoi?? »).
 *    Une variante par plateforme (Tradovate, Rithmic, WealthCharts...) : le prix
 *    est le meme sur toutes le 2026-11-28. Des prix qui different d'une
 *    plateforme a l'autre arretent la firme plutot que d'en choisir un.
 *    `has_subscription` donne le prix au mois (Launch, Propel) ou une fois
 *    (Orbit, Direct 2 Funded, Instant Funded). Les frais d'activation de Launch
 *    sont le produit « Activation Product » (groupe « No Type ») a la taille du
 *    compte ; `no_activation_fee` dit qu'il n'y en a pas (« Propel and Orbit
 *    plans have no launch fee », help.blusky.pro, Evaluation Rules, 28/11/2026).
 *    Les regles sont celles de la 1re phase, celles que le checkout affiche sous
 *    « PHASES & CONFIGURATIONS » (colonne EVAL, ou FUNDED pour un compte instant).
 *
 * 2. La page des plans, https://blusky.pro/ (« Pick the right plan for you ») :
 *    un tableau ecrit dans la page (`const skyData = { "50k": { launch:
 *    mkPlanSky({ profitGoal, evalStaticDrawdown, evalConsistency, micMin, ... }) } }`),
 *    lu sans l'executer. Il RECOUPE les regles du checkout. Les deux pages ne
 *    disent pas toujours la meme chose le 28/11/2026 : Propel 300K, checkout
 *    « $320,001 (6.67%) » / « $5,001 », page des plans et help center « $20,000 » /
 *    « $5,000 » ; contrats Propel 25K et 150K, checkout 2/25 et 1/15, page des
 *    plans et help center « 4 Mini / 40 Micros » et « 1 Mini / 10 Micros ».
 *    Quand elles se contredisent, la regle n'est PAS ecrite : le JSON garde sa
 *    valeur, le journal le dit, et le controle des regles compare le JSON a la
 *    page des plans (ce que lit un visiteur). Aucune des deux n'est choisie.
 *
 * Une regle illisible = cle absente, jamais une valeur inventee
 * (scripts/lib/catalog-sync.mjs garde alors la regle ecrite a la main).
 * Le prix publie est celui paye avec JTNQ, le prix catalogue est barre (JTNQ_OFF).
 */

import { fetchPageText } from '../cf-fetch.mjs';

export const BLUSKY_PRODUCTS_URL = 'https://blusky-f.tradetechsolutions.app/checkout/list/products_v2/';

/** La page des plans, dont le tableau recoupe les regles du checkout. */
export const BLUSKY_PLANS_URL = 'https://blusky.pro/';

/**
 * challenge_type de l'API -> nom du programme dans public/data/prop-firms.json.
 * Un challenge_type absent d'ici est publie sous le nom que le checkout affiche.
 */
export const BLUSKY_PROGRAMS = {
  Launch: 'Launch',
  PROPEL: 'Propel',
  ORBIT: 'Orbit',
  'Direct 2 Funded': 'Direct 2 Funded',
  'Instant Funded': 'Instant Funded',
};

// Ce que le code JTNQ retire, plan par plan : visuel « One code. Every BluSky plan »
// envoye par leur CM a Angelo le 2026-10-27 (« Launch $10 off, Propel 30% off, Orbit
// 30% off, Instant Funded $300 off — use code JTNQ »). Direct 2 Funded n'y est pas : JTNQ
// teste sur leur verification de coupon le 2026-10-27 (« 20% off »), les 14 autres plans y
// donnent les remises du visuel. Le prix publie est celui paye avec JTNQ, le prix catalogue est barre.
// Un programme absent d'ici est publie a son prix catalogue, sans prix barre.
export const JTNQ_OFF = {
  Launch: { usd: 10 },
  Propel: { pct: 30 },
  Orbit: { pct: 30 },
  'Direct 2 Funded': { pct: 20 },
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

const sizeTag = (size) => `$${size / 1000}K`;

/** « 1 mini or 15 micros », le format du JSON. */
const contractsWords = (minis, micros) =>
  `${minis} ${minis === 1 ? 'mini' : 'minis'} or ${micros} ${micros === 1 ? 'micro' : 'micros'}`;

/** « 5 minis or 50 micros » / « 4 Mini / 40 Micros » -> [5, 50]. */
const contractsNums = (s) => (String(s).match(/\d+/g) ?? []).map(Number);

/** 55.00 -> « 55% », 0 -> « None » (Orbit : « Orbit Evaluations have no consistency »). */
const consistencyWords = (n) => (n === 0 ? 'None' : `${Number(n.toFixed(2))}%`);

/** Un montant de l'API (« 2000 », « 1000.50 ») -> nombre > 0, sinon null. */
const amount = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

// Le drawdown, dans le vocabulaire du comparateur (futures.ts, DD_LABEL). Le checkout ecrit
// « End-of-day trailing » (EOD), « Static » (STATIC), « Trailing » (TRAILING) ; le compte
// Instant Sim Funded suit l'intraday (« $2,000 intraday trailing », help.blusky.pro, et
// tradovateTrailingMaxDrawdownMode « RealTime »).
function ddTypeOf(phase, challenge) {
  const t = phase.global_drawdown_type ?? challenge.global_drawdown_type;
  if (t === 'EOD') return 'EOD Trailing';
  if (t === 'STATIC') return 'Static';
  if (t === 'TRAILING' && phase.tradovateTrailingMaxDrawdownMode === 'RealTime') return 'Intraday';
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Le checkout (catalogue, prix, regles de la 1re phase)                */
/* ------------------------------------------------------------------ */

/**
 * Les regles de la 1re phase d'un produit. Une cle absente = illisible (`unread` dit
 * laquelle), jamais une valeur devinee.
 */
function checkoutRules(product, type, tag, notes) {
  const challenge = product.challenge;
  const phase = [...(challenge.phases ?? [])].sort((a, b) => a.step - b.step)[0];
  const rules = {};
  const unread = [];
  if (!phase) return { rules, unread: ['profitTarget', 'maxDrawdown', 'consistency', 'contracts', 'dailyLoss'] };

  // Un compte instant n'a pas d'objectif (CLAUDE.md, 22/10/2026 : pas de profit target sur un compte instant).
  if (type === 'instant') rules.profitTarget = null;
  else if (amount(phase.target_profit_amount) != null) rules.profitTarget = amount(phase.target_profit_amount);
  else unread.push('profitTarget');

  const maxDd = amount(phase.maximum_drawdown_amount);
  if (maxDd != null) rules.maxDrawdown = maxDd;
  else unread.push('maxDrawdown');

  const dd = ddTypeOf(phase, challenge);
  if (dd) rules.ddType = dd;
  else notes.push(`${tag}: drawdown « ${phase.global_drawdown_type} » hors du vocabulaire du comparateur, non ecrit`);

  if (phase.check_daily_drawdown === false) {
    // Pas de perte journaliere : help.blusky.pro, tableaux « Phase 1 — Evaluation » de Launch et
    // Propel, « Daily loss limit: None » ; Orbit, « no daily loss limit in either phase » (28/11/2026).
    rules.dailyLoss = null;
  } else if (phase.check_daily_drawdown === true && amount(phase.daily_drawdown_amount) != null) {
    const daily = amount(phase.daily_drawdown_amount);
    if (maxDd != null && daily >= maxDd) {
      // Propel 300K le 28/11/2026 : « Daily Drawdown $20,001 (6.67%) (Soft) » au checkout pour une perte
      // max de $5,001, « Daily loss limit: None » dans leur help center. Une limite journaliere plus
      // grande que la perte max ne s'atteint jamais : non ecrite, le JSON garde la sienne.
      notes.push(`${tag}: perte journaliere du checkout ($${daily}) au-dessus de la perte max ($${maxDd}), non ecrite`);
    } else {
      rules.dailyLoss = daily;
    }
  } else {
    unread.push('dailyLoss');
  }

  const cons = Number(phase.consistency);
  if (phase.consistency != null && Number.isFinite(cons) && cons >= 0) rules.consistency = consistencyWords(cons);
  else unread.push('consistency');

  if (Number.isInteger(phase.minimum_trading_days) && phase.minimum_trading_days >= 0) {
    rules.minDays = phase.minimum_trading_days;
  }

  const minis = phase.minis_limit;
  const micros = phase.micros_limit;
  if (Number.isInteger(minis) && minis > 0 && Number.isInteger(micros) && micros > 0) {
    rules.contracts = contractsWords(minis, micros);
  } else {
    unread.push('contracts');
  }
  return { rules, unread };
}

/** Les frais d'activation par taille : le produit « Activation Product » du groupe « No Type ». */
function activationFees(list) {
  const bySize = new Map();
  for (const group of list) {
    for (const product of group.products ?? []) {
      if (!product.is_activation_product) continue;
      for (const v of product.variants ?? []) {
        const size = sizeOf(v.account_size);
        const price = Number(v.price);
        if (!Number.isFinite(price)) throw new Error(`frais d'activation ${v.account_size} : prix illisible`);
        if (!bySize.has(size)) bySize.set(size, new Set());
        bySize.get(size).add(price);
      }
    }
  }
  return bySize;
}

function activationFeeOf(product, size, fees) {
  if (product.challenge.no_activation_fee === true) return 0; // « 0: the firm says there is none » (futures.ts)
  const own = new Set(product.variants.map((v) => v.activation_fee).filter((f) => f != null).map(Number));
  if (own.size > 1) throw new Error(`${product.name}: frais d'activation differents selon la plateforme (${[...own]})`);
  if (own.size === 1) return [...own][0];
  const prices = fees.get(size);
  if (!prices) throw new Error(`${product.name}: frais d'activation dus, mais aucun « Activation Product » a ${sizeTag(size)}`);
  if (prices.size !== 1) throw new Error(`${product.name}: frais d'activation differents selon la plateforme (${[...prices]})`);
  return [...prices][0];
}

/* ------------------------------------------------------------------ */
/* La page des plans de blusky.pro (recoupement)                        */
/* ------------------------------------------------------------------ */

/** Les modes du tableau de blusky.pro -> programme du JSON. « instant » : par taille, voir plus bas. */
const PLANS_PAGE_MODES = { launch: 'Launch', premium: 'Propel', orbit: 'Orbit' };

/** Les arguments d'un `mkPlanSky({ cle: "texte", cle: 123, ... })`, sans executer la page. */
function argsOf(text) {
  const args = {};
  for (const m of text.matchAll(/(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?)/g)) {
    args[m[1]] = m[2].startsWith('"') ? JSON.parse(m[2]) : Number(m[2]);
  }
  return args;
}

/**
 * Le tableau des plans de blusky.pro : [{ mode, size, args }].
 * @throws  quand la page n'a plus ce tableau (la recoupe des regles serait impossible)
 */
export function plansPageEntries(html) {
  const page = String(html ?? '');
  const start = page.indexOf('const skyData = {');
  if (start === -1) throw new Error(`${BLUSKY_PLANS_URL} : tableau des plans (skyData) introuvable, la page a change`);
  const end = page.indexOf('};', start);
  const block = page.slice(start, end === -1 ? undefined : end);
  const entries = [];
  let size = null;
  for (const m of block.matchAll(/"([\d.]+k)"\s*:\s*\{|"(\w+)"\s*:\s*mkPlanSky\(\{([^}]*)\}\)/gi)) {
    if (m[1]) {
      size = sizeOf(m[1]);
      continue;
    }
    if (size != null) entries.push({ mode: m[2], size, args: argsOf(m[3]) });
  }
  if (!entries.length) throw new Error(`${BLUSKY_PLANS_URL} : aucun plan lisible dans le tableau des plans`);
  return entries;
}

const isNA = (v) => typeof v === 'string' && /^n\/?a$/i.test(v.trim());

/** « $2,000 Trailing (EOD) » / « $1,000 Static » / « $2,000 (intraday) » -> { amount, type }. */
function pageDrawdown(text) {
  if (typeof text !== 'string' || isNA(text)) return {};
  const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  const out = {};
  if (m) out.amount = Number(m[1].replace(/,/g, ''));
  if (/trailing\s*\(eod\)/i.test(text)) out.type = 'EOD Trailing';
  else if (/\bstatic\b/i.test(text)) out.type = 'Static';
  else if (/intraday/i.test(text)) out.type = 'Intraday';
  return out;
}

/**
 * Les regles qu'une ligne du tableau AFFICHE pour son mode. Launch / Propel / Orbit : la carte
 * « Evaluation » (Profit Goal, Consistency, Drawdown), les frais « At Launch » et les contrats ;
 * la ligne « Daily Loss Limit » de cette carte ne s'affiche que pour un mode « static » qui n'est
 * plus vendu, elle n'est pas lue. Instant : seule la carte « Funded » s'affiche (Trailing
 * Drawdown, Daily Loss Limit, Consistency), pas d'objectif.
 */
function pageRules({ mode, args }) {
  const instant = mode === 'instant';
  const r = {};
  if (!instant && Number.isFinite(args.profitGoal)) r.profitTarget = args.profitGoal;
  const dd = pageDrawdown(args.evalStaticDrawdown);
  if (dd.amount != null) r.maxDrawdown = dd.amount;
  if (dd.type) r.ddType = dd.type;
  if (typeof args.evalConsistency === 'number') r.consistency = consistencyWords(args.evalConsistency);
  else if (isNA(args.evalConsistency)) r.consistency = 'None';
  const c = contractsNums(args.micMin);
  if (/mini/i.test(args.micMin ?? '') && c.length === 2) r.contracts = contractsWords(c[0], c[1]);
  if (instant && typeof args.dailyLossLimit === 'string') {
    const m = args.dailyLossLimit.match(/\$\s*([\d,]+)/);
    if (isNA(args.dailyLossLimit)) r.dailyLoss = null;
    else if (m) r.dailyLoss = Number(m[1].replace(/,/g, ''));
  }
  if (!instant && Number.isFinite(args.atLaunch)) r.activationFee = args.atLaunch;
  return r;
}

/** Deux lectures d'une meme regle disent-elles la meme chose ? */
function same(field, a, b) {
  if (field === 'contracts') return JSON.stringify(contractsNums(a)) === JSON.stringify(contractsNums(b));
  return a === b;
}

/** Les champs que les deux pages peuvent dire, dans l'ordre du journal. */
const CROSS_CHECKED = ['profitTarget', 'maxDrawdown', 'ddType', 'dailyLoss', 'consistency', 'contracts', 'activationFee'];

/* ------------------------------------------------------------------ */
/* Lecture complete                                                      */
/* ------------------------------------------------------------------ */

/**
 * Le catalogue BluSky, ses regles recoupees, et ce que le controle des regles compare.
 *
 * @param {Array} list  le JSON de l'API du checkout
 * @param {string} plansHtml  la page https://blusky.pro/
 * @returns {{
 *   programs: Array<{name: string, type: 'eval'|'instant', priceType: 'monthly'|'one-time', plans: object[]}>,
 *   rules: Array<{programName: string, size: number, rules: object}>,
 *   notes: string[],
 * }}
 *   `programs` pour syncCatalog() ; `rules` pour scripts/check-rule-drift.mjs (la valeur de la
 *   page des plans quand les deux pages se contredisent, `{ broken }` quand rien n'est lisible) ;
 *   `notes` pour le journal de la synchro.
 * @throws  quand un prix, une taille ou des frais d'activation ne se lisent pas, ou que la page
 *          des plans n'a plus son tableau
 */
export function readBluSky(list, plansHtml) {
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${BLUSKY_PRODUCTS_URL} : aucune liste de produits`);
  const page = plansPageEntries(plansHtml);
  const fees = activationFees(list);
  const notes = [];
  const programs = [];
  const rules = [];
  const read = []; // { programName, type, size, product } pour la recoupe des comptes instant

  for (const group of list) {
    const products = (group.products ?? []).filter((p) => {
      if (p.is_activation_product) return false; // « No Type » = les frais de Launch, pas un compte
      if (!p.challenge) {
        notes.push(`${p.name}: produit sans challenge, pas un compte, ignore`);
        return false;
      }
      if (p.challenge.archived || p.challenge.is_free_trial) {
        notes.push(`${p.name}: ${p.challenge.archived ? 'archive' : 'essai gratuit'}, pas vendu, ignore`);
        return false;
      }
      return true;
    });
    if (!products.length) continue;
    const name = BLUSKY_PROGRAMS[group.challenge_type] ?? String(group.challenge_type ?? '').trim();
    if (!name) throw new Error('un groupe de produits sans challenge_type');
    if (!BLUSKY_PROGRAMS[group.challenge_type]) notes.push(`programme « ${name} » inconnu jusqu'ici, publie sous son nom du checkout`);

    const kinds = new Set(products.map((p) => (p.challenge.steps === 0 ? 'instant' : 'eval')));
    const subs = new Set(products.flatMap((p) => p.variants.map((v) => v.has_subscription)));
    if (kinds.size !== 1) throw new Error(`${name}: comptes instant et evaluations dans le meme programme`);
    if (subs.size !== 1 || ![...subs].every((s) => typeof s === 'boolean')) {
      throw new Error(`${name}: abonnement et achat unique melanges, ou illisibles`);
    }
    const program = {
      name,
      type: [...kinds][0],
      priceType: [...subs][0] ? 'monthly' : 'one-time',
      plans: [],
    };

    for (const product of products) {
      const prices = new Set(product.variants.map((v) => Number(v.price)));
      if (prices.size !== 1) throw new Error(`${product.name}: prix differents selon la plateforme (${[...prices]})`);
      const sizes = new Set(product.variants.map((v) => sizeOf(v.account_size)));
      if (sizes.size !== 1) throw new Error(`${product.name}: plusieurs tailles dans un produit`);
      const listPrice = [...prices][0];
      if (!Number.isFinite(listPrice)) throw new Error(`${product.name}: prix illisible`);
      const size = [...sizes][0];
      if (program.plans.some((p) => p.size === size)) throw new Error(`${name}: deux produits a ${sizeTag(size)}`);
      program.plans.push({
        size,
        ...withCode(name, listPrice),
        activationFee: activationFeeOf(product, size, fees),
      });
      read.push({ programName: name, type: program.type, size, product });
    }
    programs.push(program);
  }

  // La ligne du tableau de blusky.pro qui decrit un compte du checkout. Un compte instant se
  // retrouve par sa taille, seulement si un seul compte instant a cette taille.
  const pageFor = ({ programName, type, size }) => {
    const mode =
      type === 'instant' ? 'instant' : Object.keys(PLANS_PAGE_MODES).find((k) => PLANS_PAGE_MODES[k] === programName);
    if (!mode) return null;
    if (type === 'instant' && read.filter((r) => r.type === 'instant' && r.size === size).length !== 1) return null;
    const rows = page.filter((e) => e.mode === mode && e.size === size);
    return rows.length === 1 ? pageRules(rows[0]) : null;
  };

  for (const r of read) {
    const plan = programs.find((p) => p.name === r.programName).plans.find((p) => p.size === r.size);
    const tag = `${r.programName} ${sizeTag(r.size)}`;
    const checkout = checkoutRules(r.product, r.type, tag, notes);
    const shown = pageFor(r) ?? {};
    const published = {};
    for (const field of CROSS_CHECKED) {
      const a = field === 'activationFee' ? plan.activationFee : checkout.rules[field];
      const b = shown[field];
      if (a !== undefined && b !== undefined && !same(field, a, b)) {
        notes.push(
          `${tag}: ${field} — checkout ${JSON.stringify(a)}, blusky.pro ${JSON.stringify(b)} : ` +
            'les deux pages se contredisent, non ecrit (le JSON garde sa valeur)',
        );
        delete plan[field];
        published[field] = b;
        continue;
      }
      const v = a !== undefined ? a : b;
      if (v === undefined) {
        if (checkout.unread.includes(field)) published[field] = { broken: `checkout : ${field} illisible` };
        continue;
      }
      plan[field] = v;
      published[field] = v;
    }
    if (checkout.rules.minDays !== undefined) plan.minDays = checkout.rules.minDays;
    rules.push({
      programName: r.programName,
      size: r.size,
      rules: Object.fromEntries(
        ['profitTarget', 'maxDrawdown', 'dailyLoss', 'consistency', 'contracts']
          .filter((f) => published[f] !== undefined)
          .map((f) => [f, published[f]]),
      ),
    });
  }

  return { programs, rules, notes };
}

/** Lit l'API du checkout et la page des plans. */
export async function fetchBluSky({ fetchImpl = fetch, pageText = fetchPageText } = {}) {
  const res = await fetchImpl(BLUSKY_PRODUCTS_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${BLUSKY_PRODUCTS_URL}`);
  const list = await res.json();
  const html = await pageText(BLUSKY_PLANS_URL, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  return readBluSky(list, html);
}
