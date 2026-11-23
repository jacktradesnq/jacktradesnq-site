/**
 * Top One Futures, lu sur leur page d'accueil (https://toponefutures.com, 301 vers
 * www.toponefutures.com) : Webflow rendu serveur, une seule page, quatre onglets de prix
 *
 *   <div data-w-tab="Elite" class="acc__content__pane v3-pricing-swiper ...">          Elite Daily
 *   <div data-w-tab="Elite Access" class="acc__content__pane v3-pricing-swiper ...">   Elite Access
 *   <div data-w-tab="Instant Sim Funded" ...>                                          Instant Sim Funded
 *   <div data-w-tab="Ignite Instant Funding" ...>                                      Ignite
 *
 * Une carte par taille (.v3-pricing-slide, « $25K Evaluation » / « $25K Account ») : prix barre
 * (.v3-price-old), prix du jour (.v3-price-current), pastille (.v3-pricing-discount), puis une ou
 * deux faces de regles, « Evaluation rules » (data-w-tab="Eval") et « Funded rules »
 * (data-w-tab="Funded"), une ligne par regle :
 *
 *   <div class="v3-table-row-info"><div>Profit Target</div></div><div class="v3-table-row-value"><div>$1,500</div></div>
 *
 * Une valeur barree garde l'ancienne dans un <em> (« <em>$3,000 </em>$4,000 ») ou dans une
 * premiere case « v3-table-row-value first » (Max Accounts « 10 | 20 ») : on garde la nouvelle,
 * l'ancienne reste lue (old).
 *
 * Ce que le visiteur voit n'est pas tout a fait le HTML : un script de la page (« PRICES COME FROM
 * CUSTOM ATTRIBUTES », lu et rendu dans un navigateur le 23/11/2026) reecrit l'onglet Elite Access
 * au chargement, interrupteurs sur leurs valeurs par defaut (drawdown funded EOD, daily loss limit
 * funded « Standard ») :
 *   - Activation Fee : le montant du HTML barre, puis ce montant moins ACTIVATION_DISCOUNT
 *     (0,25 le 23/11/2026, arrondi au dollar : $139 -> $104) ;
 *   - « Drawdown Mode » de l'evaluation : « EOD » barre puis « Static » (DD_OLD_TEXT,
 *     DD_STATIC_TEXT) ; celui du compte funded : « EOD » (le HTML dit « Intraday », c'est l'autre
 *     position de l'interrupteur).
 * Ces reglages sont relus dans le script lui-meme a chaque passage : un script absent ou change
 * arrete la firme (stale) plutot que de publier le HTML brut que personne ne voit.
 *
 * Le code imprime est TOUJOURS JTNQ (codes.md, regle d'Angelo) : le code public de la firme est
 * lu sur la page pour rien, jamais rendu par ce module.
 */

export const TOPONE_URL = 'https://toponefutures.com';
export const TOPONE_CODE = 'JTNQ';

/** data-w-tab de l'onglet -> nom du programme dans public/data/prop-firms.json. */
export const TOPONE_TABS = {
  Elite: 'Elite Daily',
  'Elite Access': 'Elite Access',
  'Instant Sim Funded': 'Instant Sim Funded',
  'Ignite Instant Funding': 'Ignite',
};
export const TOPONE_SIZES = [25000, 50000, 100000, 150000];

// Les comptes sans evaluation : on lit leur face « Funded rules », la seule (Ignite) ou celle
// ouverte par defaut (Instant Sim Funded, ses deux faces sont identiques le 23/11/2026).
const INSTANT = new Set(['Instant Sim Funded', 'Ignite']);

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#x27;': "'", '&#39;': "'", '&nbsp;': ' ' };
const text = (s) =>
  String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|quot|lt|gt|#x27|#39|nbsp);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();

/** « $1,500 » -> 1500 ; « None! », « » -> null. */
export function money(s) {
  if (s == null) return null;
  const m = String(s).match(/\$?\s*(\d[\d,]*(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

const isNone = (s) => /^none!?$/i.test(String(s).trim());

/* ------------------------------------------------------------------ */
/* Le script de la page qui reecrit Elite Access                        */
/* ------------------------------------------------------------------ */

/**
 * Les reglages du script de prix de la page. Leve une erreur s'il n'est plus la : ce que le
 * visiteur voit sur Elite Access ne se deduirait plus du HTML.
 */
export function topOnePageScript(html) {
  const str = (name) => html.match(new RegExp(`var ${name}\\s*=\\s*'([^']*)'`))?.[1];
  const raw = (name) => html.match(new RegExp(`var ${name}\\s*=\\s*([^;\\n]+);`))?.[1]?.trim();
  const pane = str('DRAWDOWN_PANE');
  const discount = Number(raw('ACTIVATION_DISCOUNT'));
  const round = raw('ROUND_ACTIVATION');
  const ddOld = str('DD_OLD_TEXT');
  const ddStatic = str('DD_STATIC_TEXT');
  if (!pane || !Number.isFinite(discount) || discount < 0 || discount >= 1 || !/^(true|false)$/.test(round ?? '') || !ddOld || !ddStatic)
    throw new Error('script de prix de la page introuvable ou change (DRAWDOWN_PANE / ACTIVATION_DISCOUNT / DD_*_TEXT)');
  return { pane, activationDiscount: discount, roundActivation: round === 'true', ddOld, ddStatic, targets: targetScript(html) };
}

/**
 * Le second script, « ELITE ACCESS PROFIT TARGET: 6% -> 4% (Nov 23, 2026) » : tant que TARGET_CUT
 * vaut true, la ligne Profit Target de l'evaluation Elite Access affiche, quelle que soit la valeur
 * du HTML, l'ancien objectif barre puis le nouveau (TARGETS, « '25': ['$1,500', '$1,000'] »).
 * Absent : le HTML est ce que le visiteur voit (null). Present mais illisible : erreur.
 */
function targetScript(html) {
  const at = html.indexOf('ELITE ACCESS PROFIT TARGET');
  if (at === -1) return null;
  const src = html.slice(at, at + 6000);
  const cut = src.match(/var TARGET_CUT\s*=\s*(true|false)\s*;/)?.[1];
  const tab = src.match(/var ACCESS_TAB\s*=\s*'([^']*)'/)?.[1];
  const body = src.match(/var TARGETS\s*=\s*\{([\s\S]*?)\};/)?.[1];
  const pairs = body ? [...body.matchAll(/'(\d+)'\s*:\s*\['([^']*)'\s*,\s*'([^']*)'\]/g)] : [];
  if (!cut || !tab || pairs.length === 0) throw new Error('script « ELITE ACCESS PROFIT TARGET » illisible');
  if (cut === 'false') return null;
  return { tab, bySize: Object.fromEntries(pairs.map(([, k, old, now]) => [Number(k) * 1000, { old, now }])) };
}

/* ------------------------------------------------------------------ */
/* Onglets, cartes, lignes                                              */
/* ------------------------------------------------------------------ */

/** Le HTML d'un onglet de prix, de son ouverture a celle du suivant. */
export function topOnePane(html, tab) {
  const panes = [...html.matchAll(/data-w-tab="([^"]+)" class="acc__content__pane v3-pricing-swiper[^"]*"/g)];
  const i = panes.findIndex((m) => m[1] === tab);
  if (i === -1) throw new Error(`onglet de prix introuvable : ${tab}`);
  const to = i + 1 < panes.length ? panes[i + 1].index : html.length;
  return html.slice(panes[i].index, to);
}

/** Les cartes d'un onglet : [{ size, html }], dans l'ordre de la page. */
export function topOneCards(pane) {
  const starts = [...pane.matchAll(/<div[^>]*class="v3-pricing-slide"[^>]*>/g)];
  return starts.map((m, i) => {
    const card = pane.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : pane.length);
    const title = card.match(/v3-pricing-title">\$(\d+)K\b/);
    if (!title) throw new Error(`carte ${i} sans taille lisible`);
    return { size: Number(title[1]) * 1000, html: card };
  });
}

const ROW =
  /<div class="v3-table-row-info"><div>([^<]*)<\/div><\/div>(?:<div class="v3-table-row-value"><div>([\s\S]*?)<\/div><\/div>|<div class="v3-table-row-value-wrapper"><div class="v3-table-row-value first"><div>([^<]*)<\/div><\/div><div class="v3-table-row-value"><div>([^<]*)<\/div><\/div>)/g;

/**
 * Les lignes d'une face : { « profit target » : { label, value, old } } (libelle en minuscules,
 * espaces insecables ramenes). Les interrupteurs (.v3-table-row-info difficulty) n'en sont pas.
 */
export function faceRows(face) {
  const rows = {};
  for (const [, label, single, first, second] of face.matchAll(ROW)) {
    const name = text(label);
    const key = name.toLowerCase();
    if (key in rows) continue; // la premiere ligne gagne
    if (single != null) {
      const old = single.match(/<em>([\s\S]*?)<\/em>/);
      rows[key] = { label: name, value: text(single.replace(/<em>[\s\S]*?<\/em>/g, ' ')), old: old ? text(old[1]) : null };
    } else {
      rows[key] = { label: name, value: text(second), old: text(first) };
    }
  }
  return rows;
}

/** Les faces de regles d'une carte : { Eval: rows, Funded: rows } (une face absente = absente). */
export function cardFaces(card) {
  const starts = [...card.matchAll(/data-w-tab="(Eval|Funded)" class="rules-tab-content w-tab-pane[^"]*"/g)];
  const faces = {};
  starts.forEach((m, i) => {
    faces[m[1]] = faceRows(card.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : card.length));
  });
  return faces;
}

/* ------------------------------------------------------------------ */
/* Lecture de la page                                                   */
/* ------------------------------------------------------------------ */

function feeAt(fee, discount, round) {
  const d = fee * (1 - discount);
  return round ? Math.round(d) : Math.round(d * 100) / 100;
}

/**
 * Les 16 cartes telles qu'un visiteur les voit au chargement :
 * [{ programName, tab, size, price, originalPrice, badge, activationFee, activationFeeOld, faces }].
 * activationFee : null sans ligne Activation Fee (Instant Sim Funded, Ignite), 0 pour « None! ».
 * Une carte, une taille ou un prix illisible leve une erreur : la firme passe stale.
 */
export function readTopOne(html) {
  const script = topOnePageScript(html);
  const out = [];
  for (const [tab, programName] of Object.entries(TOPONE_TABS)) {
    const pane = topOnePane(html, tab);
    // Une valeur par mode d'interrupteur posee sur une carte (data-eod-price…) changerait ce
    // qu'affiche la position par defaut : le modele ci-dessous ne la sait pas lire.
    if (/data-eod-(price|reset|activation)=/.test(pane)) throw new Error(`${tab}: attribut data-eod-* inattendu`);
    const cards = topOneCards(pane);
    if (cards.length !== TOPONE_SIZES.length)
      throw new Error(`${tab}: ${cards.length} cartes, ${TOPONE_SIZES.length} attendues`);
    cards.forEach((card, i) => {
      if (card.size !== TOPONE_SIZES[i])
        throw new Error(`${tab}: carte ${i} en $${card.size / 1000}K, $${TOPONE_SIZES[i] / 1000}K attendue`);
      const price = money(card.html.match(/<div class="v3-price-current">([^<]*)</)?.[1]);
      const originalPrice = money(card.html.match(/<div class="v3-price-old">([^<]*)</)?.[1]);
      if (price == null || originalPrice == null)
        throw new Error(`${tab} $${card.size / 1000}K: prix illisible`);
      const badge = text(card.html.match(/v3-pricing-discount"><div>([^<]*)</)?.[1] ?? '') || null;
      const faces = cardFaces(card.html);
      const main = INSTANT.has(programName) ? faces.Funded : faces.Eval;
      if (!main) throw new Error(`${tab} $${card.size / 1000}K: face de regles introuvable`);

      // Activation Fee : une ligne par carte d'evaluation, aucune sur les comptes instantanes.
      const feeRow = main['activation fee'];
      let activationFee = null;
      let activationFeeOld = null;
      if (feeRow) {
        if (isNone(feeRow.value)) activationFee = 0;
        else {
          const fee = money(feeRow.value);
          if (fee == null || fee <= 0 || fee > 6000) throw new Error(`${tab} $${card.size / 1000}K: activation fee « ${feeRow.value} » illisible`);
          if (tab === script.pane && script.activationDiscount > 0) {
            activationFee = feeAt(fee, script.activationDiscount, script.roundActivation);
            activationFeeOld = fee;
          } else activationFee = fee;
        }
      } else if (/Activation Fee/i.test(card.html)) {
        throw new Error(`${tab} $${card.size / 1000}K: une ligne Activation Fee illisible`);
      }

      // « Drawdown Mode » d'Elite Access, tel que le script l'ecrit au chargement.
      if (tab === script.pane) {
        for (const [face, shown, old] of [['Eval', script.ddStatic, script.ddOld], ['Funded', script.ddOld, null]]) {
          const row = faces[face]?.['drawdown mode'];
          if (row) Object.assign(row, { value: shown, old });
        }
      }
      // Profit Target de l'evaluation Elite Access, tel que le second script l'ecrit.
      const cut = script.targets?.tab === tab ? script.targets.bySize[card.size] : null;
      if (cut && faces.Eval?.['profit target']) Object.assign(faces.Eval['profit target'], { value: cut.now, old: cut.old });

      // Le bandeau de la carte (« 1 Day to Pass », « 5 Day Payouts », « Copy Trade 10 Accounts »).
      const wrap = card.html.match(/<div class="v3-pricing-info-wrap">([\s\S]*?)<div class="v3-price-wrap">/)?.[1] ?? '';
      const info = [...wrap.replace(/<svg[\s\S]*?<\/svg>/g, '').matchAll(/<div>([^<]+)<\/div>/g)].map((m) => text(m[1])).filter(Boolean);
      out.push({ programName, tab, size: card.size, price, originalPrice, badge, activationFee, activationFeeOld, info, faces });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ce que le site en tire                                               */
/* ------------------------------------------------------------------ */

/**
 * Les prix du jour, chemin `updates` de scripts/scrape-prop-firms.mjs : prix, prix barre, activation
 * fee, et la note (frais de reset, comptes max, valeurs barrees), qui bouge avec les offres de la firme.
 */
export function topOneUpdates(cards) {
  return cards.map((card) => ({
    programName: card.programName,
    size: card.size,
    price: card.price,
    originalPrice: card.originalPrice,
    activationFee: card.activationFee,
    note: noteOf(card) ?? null,
  }));
}

/**
 * La promo de la firme, au code JTNQ, tiree des pastilles de chaque onglet (jamais de la
 * banniere ni d'une phrase hors de l'onglet) : « 55% off Elite Daily » pour une pastille en
 * pourcentage ; un onglet a pastille sans pourcentage (Elite Access « SAVE NOW ») dont toutes les
 * cartes sont au meme prix barre dit « Elite Access at $39 ». null quand plus rien n'est remise.
 */
export function topOnePromo(cards) {
  const parts = [];
  for (const programName of Object.values(TOPONE_TABS)) {
    const mine = cards.filter((c) => c.programName === programName);
    const pcts = new Set(mine.map((c) => c.badge?.match(/^(\d+)% OFF$/i)?.[1]).filter(Boolean));
    if (pcts.size === 1 && mine.every((c) => c.badge && c.originalPrice > c.price)) {
      parts.push(`${[...pcts][0]}% off ${programName}`);
      continue;
    }
    const prices = new Set(mine.map((c) => c.price));
    if (prices.size === 1 && mine.every((c) => c.originalPrice > c.price)) parts.push(`${programName} at $${[...prices][0]}`);
  }
  return parts.length ? { label: parts.join(', '), code: TOPONE_CODE } : null;
}

// Libelle de ligne -> champ compare par scripts/check-rule-drift.mjs. L'evaluation et les
// comptes instantanes ecrivent la meme regle differemment (« Max Drawdown (EOD) » / « Trailing
// max drawdown », « Consistency on Eval » / « Consistency »).
const RULE_ROWS = {
  'profit target': 'profitTarget',
  'max drawdown (eod)': 'maxDrawdown',
  'max drawdown': 'maxDrawdown',
  'trailing max drawdown': 'maxDrawdown',
  'daily loss limit': 'dailyLoss',
  'consistency on eval': 'consistency',
  consistency: 'consistency',
  'max contracts': 'contracts',
};

/**
 * Les regles qu'une carte publie pour la phase que le JSON garde (l'evaluation des challenges,
 * le compte des instantanes) : { profitTarget, maxDrawdown, dailyLoss, consistency, contracts },
 * en texte, tels que la page les ecrit. Un champ absent = la carte ne le dit pas.
 */
export function topOneCardRules(card) {
  const face = INSTANT.has(card.programName) ? card.faces.Funded : card.faces.Eval;
  const rules = {};
  for (const [key, row] of Object.entries(face ?? {})) {
    const field = RULE_ROWS[key];
    if (field && !(field in rules)) rules[field] = row.value;
  }
  return rules;
}

/* ------------------------------------------------------------------ */
/* Le bloc du JSON du site                                              */
/* ------------------------------------------------------------------ */

// Le type de drawdown, dans le vocabulaire du comparateur, d'apres ce que la carte ecrit :
//   - Elite Daily « Max Drawdown (EOD) » : help.toponefutures.com « Elite Daily V2 – Overview »,
//     « End of Day trailing drawdown » -> EOD Trailing ;
//   - Instant Sim Funded, Ignite « Trailing max drawdown » + « Drawdown mode: End of day » -> EOD Trailing ;
//   - Elite Access, evaluation « Static » (ecrit par le script de la page, offre Black November).
function ddTypeOf(card) {
  const face = INSTANT.has(card.programName) ? card.faces.Funded : card.faces.Eval;
  const mode = face['drawdown mode']?.value;
  if (mode === 'Static') return 'Static';
  if (face['max drawdown (eod)']) return 'EOD Trailing';
  if (face['trailing max drawdown'] && /^end of day$/i.test(mode ?? '')) return 'EOD Trailing';
  throw new Error(`${card.programName} $${card.size / 1000}K: type de drawdown hors vocabulaire (${mode})`);
}

// Le drawdown d'evaluation d'Elite Access n'est pas sur la carte (elle ne montre que le mode) :
// help.toponefutures.com « Elite ACCESS Static – Maximum Loss Limit – Evaluation Phase (Static) »,
// lu le 23/11/2026, « Evaluation MLL (static) » $1,000 / $2,000 / $3,000 / $4,000.
export const ELITE_ACCESS_EVAL_DRAWDOWN = { 25000: 1000, 50000: 2000, 100000: 3000, 150000: 4000 };

const PROGRAMS = {
  'Elite Daily': { type: 'eval' },
  'Elite Access': { type: 'eval' },
  'Instant Sim Funded': { type: 'instant' },
  Ignite: { type: 'instant' },
};

const money$ = (n) => `$${n.toLocaleString('en-US')}`;

// Ce que la carte publie sans champ dans le JSON, dans ses mots : Reset Fee, Max Accounts, une
// valeur barree (« Profit target $1,000 (was $1,500) »), le bandeau « Copy Trade 10 Accounts ».
function noteOf(card) {
  const face = INSTANT.has(card.programName) ? card.faces.Funded : card.faces.Eval;
  const parts = [];
  const reset = face['reset fee']?.value;
  if (reset) parts.push(`Reset fee ${reset.replace(/^only\s+/i, '')}`);
  if (card.activationFeeOld != null) parts.push(`Activation fee ${money$(card.activationFee)} (was ${money$(card.activationFeeOld)})`);
  for (const key of ['profit target', 'trailing max drawdown', 'max drawdown (eod)']) {
    const row = face[key];
    if (row?.old) parts.push(`${row.label.replace(/ \(EOD\)$/, '')} ${row.value} (was ${row.old})`.replace(/^\w/, (c) => c.toUpperCase()));
  }
  const accounts = face['max accounts'];
  if (accounts) parts.push(`Max ${accounts.value} accounts${accounts.old ? ` (was ${accounts.old})` : ''}`);
  for (const line of card.info) if (/copy trade/i.test(line)) parts.push(line);
  return parts.length ? `${parts.join('. ')}.` : undefined;
}

// « 1 Day to Pass » (Elite Access) : le minimum de jours, comme minDays des autres firmes.
const minDaysOf = (card) => card.info.map((l) => l.match(/^(\d+) Days? to Pass$/i)?.[1]).find(Boolean);

/**
 * Le bloc `top-one-futures` de public/data/prop-firms.json, tel que la page le publie : prix,
 * regles de la phase gardee, note. `checkedOn` : la date de lecture (YYYY-MM-DD).
 * Ecrit une fois dans le JSON (23/11/2026) ; ensuite la synchro quotidienne ne touche que prix,
 * activation fee, note et promo, et les regles sont relues par scripts/check-rule-drift.mjs.
 */
export function topOneFirm(html, { url, checkedOn }) {
  const cards = readTopOne(html);
  const programs = Object.entries(PROGRAMS).map(([name, { type }]) => ({
    name,
    type,
    priceType: 'one-time',
    plans: cards
      .filter((c) => c.programName === name)
      .map((c) => {
        const r = topOneCardRules(c);
        const plan = {
          size: c.size,
          price: c.price,
          originalPrice: c.originalPrice,
          profitTarget: type === 'instant' ? null : money(r.profitTarget),
          maxDrawdown: name === 'Elite Access' ? ELITE_ACCESS_EVAL_DRAWDOWN[c.size] : money(r.maxDrawdown),
          ddType: ddTypeOf(c),
          dailyLoss: isNone(r.dailyLoss ?? '') ? null : money(r.dailyLoss),
          consistency: isNone(r.consistency ?? '') ? 'None' : r.consistency,
          contracts: r.contracts,
        };
        const minDays = minDaysOf(c);
        if (minDays) plan.minDays = Number(minDays);
        if (c.activationFee != null) plan.activationFee = c.activationFee;
        const note = noteOf(c);
        if (note) plan.note = note;
        return plan;
      }),
  }));
  return {
    id: 'top-one-futures',
    name: 'Top One Futures',
    split: '90%',
    payout: 'On-demand',
    promo: topOnePromo(cards),
    url,
    lastChecked: checkedOn,
    stale: false,
    programs,
  };
}

export async function fetchTopOneCards(fetchText) {
  return readTopOne(await fetchText(TOPONE_URL));
}
