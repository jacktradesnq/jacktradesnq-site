/**
 * Top One Futures, lu sur leur page d'accueil (https://toponefutures.com, 301 vers
 * www.toponefutures.com) : Webflow rendu serveur, une seule page, un onglet de prix par programme
 * (quatre le 28/11/2026)
 *
 *   <div data-w-tab="Elite" class="acc__content__pane v3-pricing-swiper ...">          Elite Daily
 *   <div data-w-tab="Elite Access" class="acc__content__pane v3-pricing-swiper ...">   Elite Access
 *   <div data-w-tab="Instant Sim Funded" ...>                                          Instant Sim Funded
 *   <div data-w-tab="Ignite Instant Funding" ...>                                      Ignite
 *
 * Le catalogue est ce que la page vend (chemin `programs` de scripts/scrape-prop-firms.mjs, comme
 * Traders Launch) : chaque onglet de prix est un programme, chaque carte une taille. Un onglet que
 * TOPONE_TABS ne connait pas prend le libelle de son bouton (« <a data-w-tab=… class="v3-tab-btn">
 * <div>Elite Daily</div> »), tel que la page l'ecrit ; une taille nouvelle est une carte de plus.
 * Ce que la page ne vend plus disparait du site (CLAUDE.md, Angelo 21/10/2026 : « tant que y a sur
 * leur site faut que ca sois sur nôtre site aussi »).
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

/**
 * data-w-tab des onglets deja publies -> nom du programme dans public/data/prop-firms.json (les noms
 * publies le 23/11/2026, gardes tels quels). Un autre onglet prend le libelle de son bouton.
 */
export const TOPONE_TABS = {
  Elite: 'Elite Daily',
  'Elite Access': 'Elite Access',
  'Instant Sim Funded': 'Instant Sim Funded',
  'Ignite Instant Funding': 'Ignite',
};

// Le type de compte. Les programmes deja publies gardent le leur ; un onglet nouveau prend celui que
// ses cartes ecrivent dans leur titre : « $25K Evaluation » (une evaluation), « $25K Account » (un
// compte finance sans evaluation, le bandeau de ces cartes dit « No Eval » le 28/11/2026).
const PROGRAM_TYPES = { 'Elite Daily': 'eval', 'Elite Access': 'eval', 'Instant Sim Funded': 'instant', Ignite: 'instant' };
const TITLE_TYPES = { evaluation: 'eval', account: 'instant' };

// La face de regles que le JSON garde : « Evaluation rules » d'une evaluation, « Funded rules » d'un
// compte sans evaluation (la seule chez Ignite, celle ouverte par defaut chez Instant Sim Funded, ses
// deux faces sont identiques le 23/11/2026).
const mainFace = (card) => (card.type === 'instant' ? card.faces.Funded : card.faces.Eval);

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
  // Les reglages sont lus dans CE script (son en-tete « PRICES COME FROM CUSTOM ATTRIBUTES »),
  // jamais dans une autre variable du meme nom ailleurs dans la page.
  const at = html.indexOf('PRICES COME FROM CUSTOM ATTRIBUTES');
  const end = at === -1 ? -1 : html.indexOf('</script>', at);
  const src = at === -1 ? '' : html.slice(at, end === -1 ? undefined : end);
  const str = (name) => src.match(new RegExp(`var ${name}\\s*=\\s*'([^']*)'`))?.[1];
  const raw = (name) => src.match(new RegExp(`var ${name}\\s*=\\s*([^;\\n]+);`))?.[1]?.trim();
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
  const end = html.indexOf('</script>', at);
  const src = html.slice(at, end === -1 ? undefined : end);
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

const PANE = /data-w-tab="([^"]+)" class="acc__content__pane v3-pricing-swiper[^"]*"/g;

/** Les data-w-tab des onglets de prix, dans l'ordre de la page. */
export function topOneTabs(html) {
  return [...html.matchAll(PANE)].map((m) => m[1]);
}

/** Le HTML d'un onglet de prix, de son ouverture a celle du suivant. */
export function topOnePane(html, tab) {
  const panes = [...html.matchAll(PANE)];
  const i = panes.findIndex((m) => m[1] === tab);
  if (i === -1) throw new Error(`onglet de prix introuvable : ${tab}`);
  const to = i + 1 < panes.length ? panes[i + 1].index : html.length;
  return html.slice(panes[i].index, to);
}

/**
 * Le libelle du bouton d'un onglet de prix (« Elite Daily » pour data-w-tab="Elite"), tel que la page
 * l'ecrit : le premier texte du bouton, avant sa pastille (« 55% OFF »). null sans bouton lisible.
 */
export function topOneTabLabel(html, tab) {
  for (const m of html.matchAll(/<a\b[^>]*\bdata-w-tab="([^"]+)"[^>]*class="v3-tab-btn[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (m[1] !== tab) continue;
    const texts = [...m[2].replace(/<svg[\s\S]*?<\/svg>/g, '').matchAll(/<div[^>]*>([^<]+)<\/div>/g)].map((t) => text(t[1])).filter(Boolean);
    return texts[0] ?? null;
  }
  return null;
}

/** Les cartes d'un onglet : [{ size, title, html }], dans l'ordre de la page. */
export function topOneCards(pane) {
  const starts = [...pane.matchAll(/<div[^>]*class="v3-pricing-slide"[^>]*>/g)];
  return starts.map((m, i) => {
    const card = pane.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : pane.length);
    const titles = [...card.matchAll(/v3-pricing-title">([^<]*)</g)];
    // Deux titres dans une carte : une carte dont l'ouverture n'est plus reconnue s'est fondue dans
    // celle d'avant. La lire ferait disparaitre une taille encore vendue.
    if (titles.length > 1) throw new Error(`carte ${i} : ${titles.length} titres, la mise en page a change`);
    const title = titles[0]?.[1].match(/^\s*\$(\d+)K\b\s*(.*)$/);
    if (!title) throw new Error(`carte ${i} sans taille lisible`);
    return { size: Number(title[1]) * 1000, title: text(title[2]), html: card };
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

// Le type d'un onglet que TOPONE_TABS ne connait pas, d'apres le titre de ses cartes.
function titleType(cards, tab) {
  const types = new Set(cards.map((c) => TITLE_TYPES[c.title.toLowerCase()]));
  if (types.size !== 1 || types.has(undefined)) {
    const titles = [...new Set(cards.map((c) => c.title))].join(' / ');
    throw new Error(`${tab}: type de compte illisible (titres « ${titles} »)`);
  }
  return [...types][0];
}

// La mention sous le prix : « One Time Fee », « One time payment », « <span class="monthly-crossed">
// Monthly Payment</span> One time fee » (Elite Daily, le mot barre ne compte pas). null si elle ne dit
// ni l'un ni l'autre.
function priceTypeOf(cardHtml) {
  const notice = cardHtml.match(/<div class="v3-pricing-notice[^"]*">([\s\S]*?)<\/div><\/div>/)?.[1];
  if (notice == null) return null;
  const said = text(notice.replace(/<span[^>]*crossed[^>]*>[\s\S]*?<\/span>/g, ' '));
  if (/\bone[\s-]?time\b/i.test(said)) return 'one-time';
  if (/\bmonth(ly)?\b/i.test(said)) return 'monthly';
  return null;
}

/**
 * Les cartes telles qu'un visiteur les voit au chargement, onglet par onglet dans l'ordre de la page :
 * [{ programName, tab, type, priceType, size, price, originalPrice, badge, activationFee, activationFeeOld, info, faces }].
 * originalPrice : null sans prix barre. activationFee : null sans ligne Activation Fee (Instant Sim
 * Funded, Ignite), 0 pour « None! ». priceType : null si la mention sous le prix ne le dit pas.
 * Une page sans onglet de prix, un onglet sans carte, une carte, une taille ou un prix illisible leve
 * une erreur : la firme passe stale.
 */
export function readTopOne(html) {
  const script = topOnePageScript(html);
  const tabs = topOneTabs(html);
  if (tabs.length === 0) throw new Error('aucun onglet de prix sur la page');
  const out = [];
  const names = new Set();
  for (const tab of tabs) {
    const programName = TOPONE_TABS[tab] ?? topOneTabLabel(html, tab) ?? tab;
    if (names.has(programName)) throw new Error(`${tab}: un second onglet de prix pour « ${programName} »`);
    names.add(programName);
    const pane = topOnePane(html, tab);
    // Une valeur par mode d'interrupteur posee sur une carte (data-eod-price…) changerait ce
    // qu'affiche la position par defaut : le modele ci-dessous ne la sait pas lire.
    if (/data-eod-(price|reset|activation)=/.test(pane)) throw new Error(`${tab}: attribut data-eod-* inattendu`);
    const cards = topOneCards(pane);
    if (cards.length === 0) throw new Error(`${tab}: aucune carte de prix dans l'onglet`);
    if (new Set(cards.map((c) => c.size)).size !== cards.length) throw new Error(`${tab}: deux cartes pour la meme taille`);
    const type = PROGRAM_TYPES[programName] ?? titleType(cards, tab);
    cards.forEach((card) => {
      const price = money(card.html.match(/<div class="v3-price-current">([^<]*)</)?.[1]);
      if (price == null) throw new Error(`${tab} $${card.size / 1000}K: prix illisible`);
      // Le prix barre : absent (ou vide) quand la firme n'en affiche plus, illisible = erreur.
      const oldText = card.html.match(/<div class="v3-price-old">([^<]*)</)?.[1];
      const originalPrice = oldText == null || text(oldText) === '' ? null : money(oldText);
      if (oldText != null && text(oldText) !== '' && originalPrice == null)
        throw new Error(`${tab} $${card.size / 1000}K: prix barre « ${text(oldText)} » illisible`);
      const badge = text(card.html.match(/v3-pricing-discount"><div>([^<]*)</)?.[1] ?? '') || null;
      const faces = cardFaces(card.html);
      const main = mainFace({ type, faces });
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
      const priceType = priceTypeOf(card.html);
      out.push({ programName, tab, type, priceType, size: card.size, price, originalPrice, badge, activationFee, activationFeeOld, info, faces });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ce que le site en tire                                               */
/* ------------------------------------------------------------------ */

/**
 * La promo de la firme, au code JTNQ, tiree des pastilles de chaque onglet (jamais de la
 * banniere ni d'une phrase hors de l'onglet) : « 55% off Elite Daily » pour une pastille en
 * pourcentage ; un onglet a pastille sans pourcentage (Elite Access « SAVE NOW ») dont toutes les
 * cartes sont au meme prix barre dit « Elite Access at $39 ». null quand plus rien n'est remise.
 */
export function topOnePromo(cards) {
  const parts = [];
  for (const programName of new Set(cards.map((c) => c.programName))) {
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
  const face = mainFace(card);
  const rules = {};
  for (const [key, row] of Object.entries(face ?? {})) {
    const field = RULE_ROWS[key];
    if (field && !(field in rules)) rules[field] = row.value;
  }
  return rules;
}

/* ------------------------------------------------------------------ */
/* Le catalogue du JSON du site                                         */
/* ------------------------------------------------------------------ */

// Le type de drawdown, dans le vocabulaire du comparateur (app/prop-firms/futures.ts, DdType), d'apres
// ce que la carte ecrit :
//   - Elite Daily « Max Drawdown (EOD) » : help.toponefutures.com « Elite Daily V2 – Overview »,
//     « End of Day trailing drawdown » -> EOD Trailing ;
//   - Instant Sim Funded, Ignite « Trailing max drawdown » + « Drawdown mode: End of day » -> EOD Trailing ;
//   - Elite Access, evaluation « Static » (ecrit par le script de la page, offre Black November) ;
//   - « Drawdown mode: Intraday » (l'autre position de l'interrupteur d'Elite Access) -> Intraday :
//     help.toponefutures.com « Elite ACCESS Intraday - Maximum Loss Limit - Funded Phase (Intraday) »,
//     lu le 28/11/2026, « Trailing Intra-Day Drawdown […] trails your highest intraday equity ».
// Un mode que cette liste ne nomme pas : undefined, la cle reste absente (jamais devinee).
function ddTypeOf(card) {
  const face = mainFace(card);
  const mode = face['drawdown mode']?.value ?? '';
  if (/^static$/i.test(mode)) return 'Static';
  if (/^(eod|end of day)$/i.test(mode)) return 'EOD Trailing';
  if (/^intraday$/i.test(mode)) return 'Intraday';
  if (!mode && face['max drawdown (eod)']) return 'EOD Trailing';
  return undefined;
}

const money$ = (n) => `$${n.toLocaleString('en-US')}`;

// Ce que la carte publie sans champ dans le JSON, dans ses mots : Reset Fee, Max Accounts, une
// valeur barree (« Profit target $1,000 (was $1,500) »), le bandeau « Copy Trade 10 Accounts ».
function noteOf(card) {
  const face = mainFace(card);
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

// Une regle en dollars telle que la carte l'ecrit : « $1,500 » -> 1500, « None! » -> null (la firme
// dit qu'il n'y en a pas). Autre chose : undefined, la carte ne se lit pas, la cle reste absente.
const amount = (v) => (v == null ? undefined : isNone(v) ? null : /^\$\s?\d[\d,]*(?:\.\d+)?$/.test(v) ? money(v) : undefined);
// « 40% » tel quel, « None! » -> "None" (comme le reste du JSON), autre chose : absente.
const pct = (v) => (v == null ? undefined : isNone(v) ? 'None' : /\d\s*%/.test(v) ? v : undefined);

/**
 * Un plan du catalogue, tel que la carte le publie. Une cle n'est posee que si la carte la dit :
 * une regle absente ou illisible reste absente, et pour un plan deja publie c'est la valeur du JSON
 * qui reste (scripts/lib/catalog-sync.mjs). C'est le cas du drawdown de l'evaluation Elite Access :
 * sa carte n'en montre que le mode, le montant vient de l'article d'aide (help.toponefutures.com
 * « Elite ACCESS Static – Maximum Loss Limit – Evaluation Phase (Static) », lu le 23/11/2026,
 * $1,000 / $2,000 / $3,000 / $4,000), tenu a la main dans le JSON.
 * profitTarget : null sur un compte sans evaluation, qui n'en a pas (CLAUDE.md, Angelo 22/10/2026).
 * note : null quand la carte n'a plus rien a dire, pour qu'une ancienne note ne reste pas.
 */
function planOf(card) {
  const r = topOneCardRules(card);
  const plan = { size: card.size, price: card.price, originalPrice: card.originalPrice };
  const put = (key, value) => {
    if (value !== undefined) plan[key] = value;
  };
  put('profitTarget', card.type === 'instant' ? null : amount(r.profitTarget));
  put('maxDrawdown', amount(r.maxDrawdown) ?? undefined); // « None! » n'est pas un drawdown : absente
  put('ddType', ddTypeOf(card));
  put('dailyLoss', amount(r.dailyLoss));
  put('consistency', pct(r.consistency));
  put('contracts', r.contracts && /\d/.test(r.contracts) ? r.contracts : undefined);
  const minDays = minDaysOf(card);
  if (minDays) plan.minDays = Number(minDays);
  // Activation fee : la ligne de la carte. Une evaluation dont la carte n'en a plus perd l'ancien
  // montant (null) ; un compte sans evaluation n'en a jamais eu, la cle reste absente.
  if (card.activationFee != null || card.type === 'eval') plan.activationFee = card.activationFee;
  plan.note = noteOf(card) ?? null;
  return plan;
}

/**
 * Le catalogue que la page vend, chemin `programs` de scripts/scrape-prop-firms.mjs (guardCatalog +
 * syncCatalog) : un programme par onglet de prix, dans l'ordre de la page, un plan par carte.
 * priceType n'est pose que si toutes les cartes de l'onglet disent la meme chose.
 */
export function topOnePrograms(cards) {
  const programs = [];
  for (const name of new Set(cards.map((c) => c.programName))) {
    const mine = cards.filter((c) => c.programName === name);
    const program = { name, type: mine[0].type };
    const kinds = new Set(mine.map((c) => c.priceType));
    if (kinds.size === 1 && mine[0].priceType) program.priceType = mine[0].priceType;
    program.plans = mine.map(planOf);
    programs.push(program);
  }
  return programs;
}

export async function fetchTopOneCards(fetchText) {
  return readTopOne(await fetchText(TOPONE_URL));
}
