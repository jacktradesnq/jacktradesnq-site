/**
 * Vest Markets (perps, id vest-markets), relu chaque jour par scripts/scrape-perps.mjs.
 *
 * Source : le catalogue public que lit leur propre page (vestmarkets.com, « Instant Accounts »,
 * « Evaluation Accounts », « Create Custom Account ») : api-gateway.hz.vestmarkets.com/v3/payments.
 *   - /catalog/options : les tailles de chaque type et les choix du 1-Step (objectif, drawdown, split,
 *     daily loss) ;
 *   - /catalog : chaque compte en vente avec son prix (8 Instant + 336 évals 1-Step le 28/11/2026).
 * Lu le 28/11/2026 : plus aucun 2-Step (« 2-Step returns in limited quantities through Vest
 * Experimental », onglet « Coming Soon »), plus de daily loss (« Hard-breach Daily Loss Limit accounts
 * are no longer sold in the Customizer », docs.vestmarkets.com/vest-capital/overview) ; Angelo, 28/11 :
 * « 2 step? ca existe pas 2 step avec vest ».
 *
 * Affichage du 1-Step depuis le 28/11/2026 : un seul programme, une ligne par taille, et trois curseurs
 * comme ceux de leur configurateur (objectif, drawdown max, split), chacun dans la colonne qu'il change ;
 * le prix de la ligne suit la combinaison choisie (Angelo, 28/11/2026, sur les 4 prix empilés « $31.50
 * $35 / $36 $40 / $40.50 $45 / $45 $50 » : « un humain qui lit ca se dit, ok je comprends rien LOL mais
 * enfaite vest vu que y a pleins de combinaison je pense faut faire ca de vest », « tu clique tu drag
 * gauche droite, quand y a bcp de choix possible pour pas prendre trop trop de place, je pense ca c
 * mieux »). Position de départ = les défauts que leur catalogue publie (« default » de chaque règle de
 * /catalog/options), jamais écrits ici. Avant : un programme par objectif et drawdown, 4 prix par case.
 * Un compte que Vest ajoute ou retire apparaît / disparaît seul (Angelo, 28/11/2026, règle du 21/10 :
 * « tant que y a sur leur site faut que ca sois sur nôtre site aussi »).
 *
 * Remise JTNQ : le taux du code ne se lit que connecté (tableau affilié, 28/11/2026 : « Discount Coupon
 * Active · Evaluation 10% · Instant 5% »). La doc publique dit pourquoi les évals sont à 10 % : « For a
 * limited time, creator codes give double their discount on Evaluation accounts »
 * (docs.vestmarkets.com/vest-capital/account-tiers, « Updated November 23, 2026 »). Le taux de base
 * (instantPct, 5 %) vient du JSON ; la phrase présente = évals au double, absente = évals au taux de base.
 */

export const VEST_API = 'https://api-gateway.hz.vestmarkets.com/v3/payments';
export const VEST_DOCS_TIERS = 'https://docs.vestmarkets.com/vest-capital/account-tiers';
export const VEST_PERPS_SOURCE = `${VEST_API}/catalog/options, ${VEST_API}/catalog, ${VEST_DOCS_TIERS}`;
// La phrase de la doc qui double la remise des créateurs sur les évals.
export const DOUBLE_RE = /creator codes give double their discount on Evaluation/i;

const num = (v) => (v === '' || v == null ? null : Number(v));
const pct = (v) => Math.round(Number(v) * 10000) / 100; // « 0.060000 » -> 6
const money = (n) => `$${n.toLocaleString('en-US')}`;
const round2 = (n) => Math.round(n * 100) / 100;

/** Un produit du catalogue réduit à ce que le site affiche (la fixture garde cette forme). */
export function slimProduct(p) {
  const plan = p.plan ?? {};
  return {
    type: p.productType,
    steps: plan.stepsTotal,
    size: num(plan.accountSize),
    goal: num(plan.stepGoal),
    dd: num(plan.maxDrawdownPct),
    dll: num(plan.maxDailyLossPct),
    split: num(plan.maxProfitSplitPct),
    price: num(p.price?.amount),
    currency: p.price?.currency ?? null,
    name: p.name,
  };
}

/**
 * Réseau : rend le snapshot { options, products, docsDouble } (ce que la fixture stocke).
 * fetchJson(url) et fetchText(url) lèvent si la page ne répond pas.
 */
export async function readVestPerps({ fetchText }) {
  const json = async (url) => {
    const t = await fetchText(url);
    try {
      return JSON.parse(t);
    } catch {
      throw new Error(`Vest illisible : ${url} ne rend pas du JSON (${t.slice(0, 80)})`);
    }
  };
  const options = await json(`${VEST_API}/catalog/options`);
  const catalog = await json(`${VEST_API}/catalog`);
  const docs = await fetchText(VEST_DOCS_TIERS);
  if (!/Account Tiers/i.test(docs)) throw new Error(`Vest illisible : ${VEST_DOCS_TIERS} sans « Account Tiers »`);
  return {
    options,
    products: (catalog.products ?? []).map(slimProduct),
    docsDouble: DOUBLE_RE.test(docs),
  };
}

/**
 * Pur : snapshot -> { programs, promo } au format de public/data/perps-firms.json.
 * `promo` = la promo actuelle du JSON (code, taux de base instantPct). Lève « Vest illisible : … »
 * dès qu'un compte annoncé par /catalog/options manque, qu'un prix est aberrant, ou que Vest vend
 * quelque chose que ce lecteur ne sait pas montrer (une daily loss, un 2-Step) : la firme passe alors
 * stale et le job rouge, plutôt que de publier une page fausse.
 */
export function vestPerpsFromSnapshot(snap, { checkedOn, promo }) {
  const fail = (why) => {
    throw new Error(`Vest illisible : ${why}`);
  };
  const types = snap?.options?.types;
  const rules = snap?.options?.oneStepRules;
  if (!Array.isArray(types) || !rules) fail('catalog/options sans types ni oneStepRules');
  const products = snap.products ?? [];
  if (!products.length) fail('catalogue vide');

  const known = new Set(['instant_funded|0', 'eval|1']);
  for (const t of types) if (!known.has(`${t.productType}|${t.stepsTotal}`)) fail(`type de compte inconnu : ${t.productType} en ${t.stepsTotal} step(s)`);
  for (const p of products) {
    if (!known.has(`${p.type}|${p.steps}`)) fail(`compte inconnu dans le catalogue : ${p.name}`);
    if (p.currency !== 'USD') fail(`${p.name} : prix en ${p.currency}`);
    if (!(p.price >= 1 && p.price <= 20000)) fail(`${p.name} : prix aberrant ${p.price}`);
    if (p.dll !== 0) fail(`${p.name} : une daily loss de ${pct(p.dll)} % est de nouveau vendue, à relire`);
  }
  const dllChoices = (rules.dailyLossPct?.values ?? []).map(Number);
  if (dllChoices.some((v) => v !== 0)) fail(`le 1-Step propose de nouveau une daily loss (${dllChoices.join(', ')})`);

  const sizesOf = (type) => (types.find((t) => t.productType === type)?.accountSizes ?? []).map(Number).sort((a, b) => a - b);
  const instantSizes = sizesOf('instant_funded');
  const evalSizes = sizesOf('eval');
  if (!instantSizes.length || !evalSizes.length) fail('catalog/options sans tailles Instant ou 1-Step');
  const values = (k) => (rules[k]?.values ?? []).map(Number).sort((a, b) => a - b);
  const targets = values('profitTargetPct');
  const dds = values('maxDrawdownPct');
  const splits = values('profitSplitPct');
  if (!targets.length || !dds.length || !splits.length) fail('1-Step sans objectif, drawdown ou split');

  const basePct = promo?.instantPct;
  if (!(basePct > 0)) fail('promo.instantPct (taux de base du code JTNQ) absent du JSON');
  const evalPct = snap.docsDouble ? basePct * 2 : basePct;
  const off = (price, rate) => round2((price * (100 - rate)) / 100);

  // Instant : un compte par taille, prix = drawdown en dollars.
  const instant = instantSizes.map((size) => {
    const p = products.find((x) => x.type === 'instant_funded' && x.size === size);
    if (!p) fail(`Instant ${money(size)} annoncé mais absent du catalogue`);
    return p;
  });
  const instantSplits = new Set(instant.map((p) => pct(p.split)));
  if (instantSplits.size !== 1) fail(`Instant vendu à plusieurs splits (${[...instantSplits].join(', ')})`);
  const ddPcts = instant.map((p) => pct(p.dd));
  const ddRange = Math.min(...ddPcts) === Math.max(...ddPcts) ? `${ddPcts[0]}%` : `${Math.min(...ddPcts)}–${Math.max(...ddPcts)}%`;

  // Position de départ des curseurs : le « default » de chaque règle, lu dans leur catalogue.
  const defaultOf = (k, list) => {
    const d = Number(rules[k]?.default);
    if (!list.includes(d)) fail(`1-Step : le défaut de ${k} (${rules[k]?.default}) n'est pas l'un de ses choix (${list.join(', ')})`);
    return d;
  };
  const start = { goal: defaultOf('profitTargetPct', targets), dd: defaultOf('maxDrawdownPct', dds), split: defaultOf('profitSplitPct', splits) };
  const range = (list) => (list.length === 1 ? `${pct(list[0])}%` : `${pct(list[0])}–${pct(list[list.length - 1])}%`);

  // 1-Step : un programme, une ligne par taille ; chaque ligne porte la grille de tous ses prix
  // (objectif × drawdown × split), price / promoPrice = la combinaison par défaut.
  const plans = evalSizes.map((size) => {
    const grid = [];
    for (const goal of targets)
      for (const dd of dds)
        for (const split of splits) {
          const p = products.find(
            (x) => x.type === 'eval' && x.size === size && Math.abs(x.goal - size * goal) < 0.01 && x.dd === dd && x.split === split,
          );
          if (!p) fail(`1-Step ${money(size)} ${pct(goal)} % / ${pct(dd)} % / split ${pct(split)} % annoncé mais absent du catalogue`);
          grid.push({ profitTarget: pct(goal), maxDrawdown: pct(dd), split: pct(split), price: p.price, promoPrice: off(p.price, evalPct) });
        }
    const first = grid.find((g) => g.profitTarget === pct(start.goal) && g.maxDrawdown === pct(start.dd) && g.split === pct(start.split));
    return {
      size,
      price: first.price,
      promoPrice: first.promoPrice,
      lines: [{ label: 'Max drawdown', value: money(Math.round(size * start.dd)) }],
      grid,
    };
  });
  const programs = [
    {
      name: '1-Step',
      steps: '1 step',
      split: splits.map((s) => `${pct(s)}%`).join(' / '),
      profitTarget: range(targets),
      maxDrawdown: range(dds),
      ddType: 'Static',
      dailyLoss: 'None',
      note: '',
      // Un curseur par règle au choix : `field` = le champ du programme qu'il remplace et la clé de la
      // grille, `values` en %, `default` = position de départ (leur catalogue).
      sliders: [
        { field: 'profitTarget', label: 'Profit target', values: targets.map(pct), default: pct(start.goal) },
        { field: 'maxDrawdown', label: 'Max drawdown', values: dds.map(pct), default: pct(start.dd) },
        { field: 'split', label: 'Profit split', values: splits.map(pct), default: pct(start.split) },
      ],
      plans,
    },
  ];
  programs.push({
    name: 'Instant',
    steps: 'Instant',
    split: `${[...instantSplits][0]}%`,
    profitTarget: null,
    maxDrawdown: ddRange,
    ddType: 'Static',
    dailyLoss: 'None',
    note: '',
    plans: instant.map((p) => ({
      size: p.size,
      price: p.price,
      promoPrice: off(p.price, basePct),
      lines: [{ label: 'Max drawdown', value: `${money(Math.round(p.size * p.dd))} (${pct(p.dd)}%)` }],
    })),
  });

  return {
    programs,
    promo: { ...promo, code: 'JTNQ', discountPct: evalPct, instantPct: basePct, endsAt: null, lastChecked: checkedOn },
  };
}
