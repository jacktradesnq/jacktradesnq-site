/**
 * E8 Markets, marche Perpetual (id `e8-perps` de public/data/perps-firms.json), relu sur leur site
 * public, sans navigateur : le configurateur de e8markets.com/?market=perpetual (« Account
 * configurator ») est une page Nuxt qui calcule ses prix dans le navigateur a partir de donnees
 * JSON publiques. On lit ces memes donnees, et le code du site qui les transforme.
 *
 * Ce que le site publie (lu le 2026-11-28, tout en GET, curl_cffi derriere Cloudflare) :
 *   - https://e8markets.com/api/data/global : `data.products`, un objet par compte (e8one_perp,
 *     e8pro_v2_perp, e8classic_perp…) : prix de base par taille (`balances`), options du
 *     configurateur (`settings.drawdowns`, `settings.payoutShares`, `settings.dailyDrawdowns`),
 *     coefficients de prix par palier de taille (`settings.pricing` : dlt/dht, plt/pht, ddlt/ddht),
 *     regles (`evaluation`, `funded`), remise (`firstDiscount`, `discount`).
 *   - https://e8markets.com/api/data/discount-codes : la page « Discount Codes » (taux, comptes
 *     couverts, `expiration_date`).
 *   - le code du configurateur, trois petits fichiers /_nuxt/*.js precharges par la page :
 *       catalogue  : id -> nom affiche + marche (`e8one_perp:{id,name:"E8 One",market:"perpetual"}`) ;
 *       prix       : prix = base x (1 + (dd - dd de base) x dlt|dht) x (1 + (payout - payout de base) x
 *                    plt|pht), arrondi au dollar superieur ; avec code = ceil(prix x (100 - remise) / 100) ;
 *       regles     : cible / perte journaliere en % = valeur ecrite, sinon drawdown x multiplicateur arrondi
 *                    a 0,1 ; une exception du site : E8 One a 4 % de drawdown -> perte journaliere x 0,75.
 *     Le calcul est refait ici a l'identique ; le code du site est relu a chaque passage et compare a
 *     cette forme (fingerprint) : une formule changee arrete la lecture plutot que de publier des prix
 *     faux. L'exception « 4 % -> 0,75 » est relue dans le code, pas recopiee.
 *   - le rendu serveur du configurateur (texte de la page) : les tuiles du programme affiche par defaut
 *     (E8 One, 6 % Max, 80 %) servent de controle croise du calcul.
 *   - https://e8x.e8markets.com/trading-symbols (« Pairs ») : la page interroge
 *     api.e8markets.com/graphql/front (`symbols`, market = perpetual, 500 max, tri par symbole) ; la
 *     meme requete passe en GET sans connexion.
 *
 * Ce que le site ne porte pas, et ce qu'on en fait :
 *   - `rulesKey` : derive du nom affiche (« E8 One » -> « One »), la cle de DETAILS / FUNDED de
 *     app/prop-firms/perps.ts.
 *   - `note` d'un plan (phrases relues sur help.e8markets.com le 01/11/2026 : best day, news, payout…) :
 *     reprise de l'entree precedente (`previous`, meme programme, meme taille) ; seule sa premiere
 *     phrase « Prices for 80%, 90% and 100% payout, in that order. » est reecrite d'apres les payouts
 *     du configurateur. Sans entree precedente, la note se limite a cette phrase.
 *   - `note` d'un programme : celle de l'entree precedente, sinon vide.
 *
 * Le code imprime est TOUJOURS JTNQ ; le code public de la firme n'est ni garde dans l'instantane ni
 * rendu par ce module. Rien n'est achete, aucun formulaire, aucune connexion.
 */
import { fetchPageText } from '../cf-fetch.mjs';

const SITE = 'https://e8markets.com';
const SYMBOLS_QUERY =
  'query getSymbols($filter: SymbolEntityFilterInput, $pagination: PaginationArg, $sort: [SortArg]) ' +
  '{ symbols(filter: $filter, pagination: $pagination, sort: $sort) { nodes { symbol group market } totalRows } }';
const SYMBOLS_VARS = { filter: { market: { eq: 'perpetual' } }, pagination: { limit: 500, start: 0 }, sort: [{ column: 'symbol', desc: false }] };

export const E8_PERPS_CODE = 'JTNQ';
export const E8_PERPS_SOURCE = {
  page: `${SITE}/?market=perpetual`,
  products: `${SITE}/api/data/global`,
  codes: `${SITE}/api/data/discount-codes`,
  symbolsPage: 'https://e8x.e8markets.com/trading-symbols',
  symbols:
    'https://api.e8markets.com/graphql/front?query=' +
    encodeURIComponent(SYMBOLS_QUERY) +
    '&variables=' +
    encodeURIComponent(JSON.stringify(SYMBOLS_VARS)),
};

const fail = (why) => {
  throw new Error(`E8 perps illisible : ${why}`);
};

// ---------------------------------------------------------------------------------------------
// Lecture (reseau) -> instantane brut
// ---------------------------------------------------------------------------------------------

/** Les trois fichiers du configurateur, reconnus a leur contenu (leurs noms changent a chaque build). */
const CODE_KINDS = {
  catalog: (t) => /PERPETUAL="perpetual"/.test(t) && /market:"perpetual"/.test(t) && /name:"/.test(t),
  pricing: (t) => /depositFrom/.test(t) && /\.dlt\b/.test(t) && /Math\.ceil/.test(t),
  rules: (t) => /"dailyDrawdownFrom"/.test(t) && /\.multiplier\b/.test(t) && /challenges\.rules\.labels/.test(t),
};

/** Texte visible (lignes non vides) d'un morceau de HTML. */
function visibleLines(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&#x2F;/gi, '/')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Les lignes du configurateur rendu par le serveur, de « Account configurator » a « Save with code ». */
export function configuratorLines(html) {
  const lines = visibleLines(html);
  const from = lines.findIndex((l) => /^account configurator$/i.test(l));
  if (from < 0) return [];
  const to = lines.findIndex((l, i) => i > from && /^save with code$/i.test(l));
  return lines.slice(from, to < 0 ? Math.min(lines.length, from + 400) : to + 1);
}

/**
 * Lit le site (rien d'autre que des GET publics) et rend l'instantane brut que la fixture stocke.
 * `fetchText(url)` -> texte (par defaut fetchPageText de scripts/lib/cf-fetch.mjs : fetch, puis curl_cffi
 * sur un 403 Cloudflare). `chromium` n'est pas utilise : tout se lit sans navigateur.
 */
export async function readE8Perps({ fetchText = fetchPageText, chromium: _unused } = {}) {
  const get = (url) => Promise.resolve(fetchText(url)).then(String);
  const json = async (url, what) => {
    const text = await get(url);
    try {
      return JSON.parse(text);
    } catch {
      return fail(`${what} n'est pas du JSON (${url}) : ${text.slice(0, 120)}`);
    }
  };

  const html = await get(E8_PERPS_SOURCE.page);
  const global = await json(E8_PERPS_SOURCE.products, 'api/data/global');
  const codes = await json(E8_PERPS_SOURCE.codes, 'api/data/discount-codes');
  const symbols = await json(E8_PERPS_SOURCE.symbols, 'la liste des symboles');

  const entry = /<script[^>]*type="module"[^>]*src="([^"]+)"/i.exec(html)?.[1] ?? null;
  const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+\.js)"/gi)]
    .map((m) => m[1])
    .filter((src, i, all) => src !== entry && all.indexOf(src) === i);
  const code = {};
  const files = {};
  for (const src of preloads) {
    if (Object.keys(CODE_KINDS).every((k) => code[k])) break;
    const text = await get(new URL(src, SITE).href);
    for (const [kind, is] of Object.entries(CODE_KINDS)) {
      if (!code[kind] && is(text)) {
        code[kind] = text;
        files[kind] = src;
      }
    }
  }

  // Le code public de la firme ne reste pas dans l'instantane (jamais ecrit, jamais imprime) : retire des
  // comptes, de la liste des codes et du texte du configurateur (« Save $244 with code … »).
  const products = structuredClone(global?.data?.products ?? null);
  const publicCodes = new Set();
  for (const p of Object.values(products ?? {})) {
    if (p.discountCode) publicCodes.add(String(p.discountCode));
    delete p.discountCode;
  }
  const discountCodes = Array.isArray(codes?.data)
    ? codes.data.map(({ code: c, ...rest }) => {
        if (c) publicCodes.add(String(c));
        return rest;
      })
    : null;
  // Seulement la ou la page montre un code (« with code X », la ligne sous « Save with code ») : un code
  // peut s'ecrire comme le nom de la firme (« E8 »), les noms de comptes ne sont pas touches.
  const hideCodes = (line, i, all) =>
    /^save with code$/i.test(all[i - 1] ?? '') && publicCodes.has(line)
      ? '[code]'
      : line.replace(/(with code )(\S+)/gi, (m, lead, c) => (publicCodes.has(c) ? `${lead}[code]` : m));

  return {
    source: E8_PERPS_SOURCE,
    readAt: new Date().toISOString(),
    products,
    discountCodes,
    code: { files, ...code },
    configurator: configuratorLines(html).map((l, i, all) => hideCodes(l, i, all)),
    symbols: symbols?.data?.symbols
      ? {
          totalRows: symbols.data.symbols.totalRows,
          nodes: (symbols.data.symbols.nodes ?? []).filter(Boolean).map(({ symbol, group, market }) => ({ symbol, group, market })),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Le code du configurateur : catalogue, formule de prix, regles
// ---------------------------------------------------------------------------------------------

const ID = '[A-Za-z_$][\\w$]*';
const NUM = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const rx = (s, flags) => new RegExp(s.replace(/ID/g, ID).replace(/NUM/g, NUM), flags);
const esc = (s) => s.replace(/[$]/g, '\\$');

/** Catalogue du site : comptes connus (id, nom affiche, marche) dans l'ordre du configurateur, et l'enum A.E8_ONE_PERP -> id. */
export function parseCatalog(text) {
  const entries = [...String(text).matchAll(rx('(?:^|[{,])ID:\\{id:"([^"]+)",name:"([^"]+)",code:"[^"]*",market:"([^"]+)"\\}', 'g'))].map(
    (m) => ({ id: m[1], name: m[2], market: m[3] }),
  );
  const enumIds = Object.fromEntries([...String(text).matchAll(rx('ID\\.([A-Z][A-Z0-9_]*)="([a-z0-9_]+)"', 'g'))].map((m) => [m[1], m[2]]));
  if (!entries.some((e) => e.market === 'perpetual')) fail('catalogue des comptes sans aucun compte « perpetual »');
  return { entries, enumIds };
}

/**
 * La formule de prix du site, relue telle quelle. Chaque morceau ci-dessous est celui du fichier lu le
 * 2026-11-28 (noms de variables libres : ils changent a chaque build). Un morceau absent = la formule a
 * change : on s'arrete.
 */
const PRICING_SHAPE = [
  ['palier de taille', 'find\\(\\(\\{depositFrom:(ID),depositTo:(ID)\\}\\)=>(ID)>=\\1&&\\(\\2===null\\|\\|\\3<\\2\\)\\)\\?\\?null'],
  [
    'ajustement drawdown / payout / perte journaliere',
    'const\\{tier:(ID),drawdown:(ID),baseDrawdown:(ID),payoutShare:(ID),baseProfitSplit:(ID),dailyDrawdown:(ID),baseDailyDrawdown:(ID)\\}=(ID);let (ID)=\\8\\.price;' +
      'const (ID)=\\(\\2<\\3\\?\\1\\.dlt:\\1\\.dht\\)\\?\\?0;if\\(\\9\\*=1\\+\\(\\2-\\3\\)\\*\\10,\\6!==null&&\\7!==null&&\\6!==\\7\\)\\{' +
      'const (ID)=\\6<\\7\\?\\1\\.ddlt:\\1\\.ddht;if\\(!Number\\.isFinite\\(\\11\\)\\)return Number\\.NaN;\\9\\*=1\\+\\(\\6-\\7\\)\\*\\11\\}' +
      'const (ID)=\\(\\4<\\5\\?\\1\\.plt:\\1\\.pht\\)\\?\\?0;return \\9\\*=1\\+\\(\\4-\\5\\)\\*\\12,\\6===null\\?\\9:Math\\.round\\(\\9\\*100\\)\\/100\\}',
  ],
  ['drawdown de base', '(ID)\\.evaluation\\.drawdown\\?\\?\\1\\.settings\\.drawdowns\\[0\\]\\?\\?ID'],
  ['payout de base', '(ID)\\.settings\\.payoutShares\\[0\\]\\?\\?ID'],
  ['arrondi du prix', 'baseDailyDrawdown:ID\\(ID\\)\\}\\)\\}return Math\\.ceil\\(ID\\)\\}'],
  ['prix avec code', 'return (ID)<=0\\?(ID):Math\\.ceil\\(\\2\\*\\(100-\\1\\)\\/100\\)'],
  ['options de perte journaliere', 'const (ID)=\\(?ID\\)?<ID\\?"ddlt":"ddht";return ID\\.length>0&&ID\\.every\\(\\(?(ID)\\)?=>Number\\.isFinite\\(\\2\\[\\1\\]\\)\\)'],
  ['perte journaliere de base', '(ID)=ID\\?\\.evaluation\\?\\.dailyDrawdown;return \\1!==void 0&&(ID)\\.includes\\(\\1\\)\\?\\1:\\2\\[0\\]\\?\\?null'],
];

export function checkPricingCode(text) {
  const missing = PRICING_SHAPE.filter(([, re]) => !rx(re).test(String(text))).map(([what]) => what);
  if (missing.length) fail(`formule de prix du configurateur changee (${missing.join(', ')}) : a relire a la main`);
  return true;
}

/**
 * Regles du configurateur : formes attendues + l'exception de perte journaliere (E8 One a 4 % : x 0,75
 * le 2026-11-28), relue dans le code. Rend { dailyOverride: { ids, drawdown, multiplier } | null, ddTypes }.
 */
export function parseRulesCode(text, catalog) {
  const s = String(text);
  const shapes = [
    ['cible', '(ID)\\(ID,ID,ID,"profitTarget","profitTargetFrom",ID\\)'],
    ['perte journaliere', '\\?\\?ID\\(ID,ID,ID,"dailyDrawdown","dailyDrawdownFrom",ID\\)'],
    ['remise', 'ID\\(ID,"evaluation","firstDiscount",ID\\)\\?\\?ID\\(ID,"evaluation","discount",ID\\)\\?\\?0'],
    ['type de drawdown', 'ID\\(ID,ID,"drawdownType",ID\\)\\?\\?"eod"'],
  ];
  const missing = shapes.filter(([, re]) => !rx(re).test(s)).map(([what]) => what);
  // P() : valeur ecrite, sinon multiplicateur (avec ou sans exception) x drawdown, arrondi a 0,1.
  const withOverride = rx(
    'let (ID)=(ID)\\.multiplier;ID==="dailyDrawdownFrom"&&\\(\\1=(ID)\\(ID,ID\\)\\?\\?\\1\\);const (ID)=\\2\\.from==="drawdown"\\?ID:ID;return Math\\.round\\(\\4\\*\\1\\*10\\)\\/10\\}',
  ).exec(s);
  const plain = rx('let (ID)=(ID)\\.multiplier;const (ID)=\\2\\.from==="drawdown"\\?ID:ID;return Math\\.round\\(\\3\\*\\1\\*10\\)\\/10\\}').exec(s);
  if (!withOverride && !plain) missing.push('regle derivee du drawdown');
  if (missing.length) fail(`regles du configurateur changees (${missing.join(', ')}) : a relire a la main`);

  let dailyOverride = null;
  if (withOverride) {
    const fn = withOverride[3];
    const def = rx(`function ${esc(fn)}\\((ID),(ID)\\)\\{return (ID)\\.includes\\(\\1\\)&&\\2===(NUM)\\?(NUM):null\\}`).exec(s);
    if (!def) fail(`exception de perte journaliere (${fn}) illisible`);
    const list = rx(`(?:const |,)${esc(def[3])}=\\[([^\\]]*)\\]`).exec(s);
    if (!list) fail('liste des comptes de l\'exception de perte journaliere introuvable');
    const names = list[1].split(',').map((x) => x.trim().split('.').pop());
    const ids = names.map((n) => catalog.enumIds[n]);
    if (ids.some((x) => !x)) fail(`comptes de l'exception inconnus du catalogue : ${names.join(', ')}`);
    dailyOverride = { ids, drawdown: Number(def[4]), multiplier: Number(def[5]) };
  }
  const ddTypes = [...s.matchAll(rx('(ID):\\{key:"(ID)Drawdown",labelKey:"challenges\\.rules\\.labels\\.\\2Drawdown"\\}', 'g'))].map((m) => m[1]);
  return { dailyOverride, ddTypes };
}

// ---------------------------------------------------------------------------------------------
// Le calcul du configurateur, refait a l'identique (memes operations, memes arrondis)
// ---------------------------------------------------------------------------------------------

/** Le getter du site : valeur de la taille, sinon de la phase, sinon du compte (payoutShare : 1er payout). */
function field(product, phase, key, balance) {
  const b = product.balances?.[String(balance)];
  return b?.[phase]?.[key] ?? product[phase]?.[key] ?? product[key] ?? (key === 'payoutShare' ? product.settings?.payoutShares?.[0] : undefined);
}

const sizesOf = (product) => Object.values(product.balances ?? {}).map((b) => b.balance).sort((a, b) => a - b);
const dailyList = (product) => product?.settings?.dailyDrawdowns ?? [];

function baseDaily(product) {
  const list = dailyList(product);
  const r = product?.evaluation?.dailyDrawdown;
  return r !== undefined && list.includes(r) ? r : list[0] ?? null;
}

function dailyOptions(product) {
  const base = baseDaily(product);
  const tiers = product?.settings?.pricing ?? [];
  return dailyList(product).filter((d) => {
    if (d === base || base === null) return true;
    const k = d < base ? 'ddlt' : 'ddht';
    return tiers.length > 0 && tiers.every((t) => Number.isFinite(t[k]));
  });
}

function tierOf(product, balance) {
  return (product.settings?.pricing ?? []).find(({ depositFrom, depositTo }) => balance >= depositFrom && (depositTo === null || balance < depositTo)) ?? null;
}

function adjust({ price, tier, drawdown, baseDrawdown, payoutShare, baseProfitSplit, dailyDrawdown, baseDailyDrawdown }) {
  let i = price;
  const l = (drawdown < baseDrawdown ? tier.dlt : tier.dht) ?? 0;
  i *= 1 + (drawdown - baseDrawdown) * l;
  if (dailyDrawdown !== null && baseDailyDrawdown !== null && dailyDrawdown !== baseDailyDrawdown) {
    const g = dailyDrawdown < baseDailyDrawdown ? tier.ddlt : tier.ddht;
    if (!Number.isFinite(g)) return Number.NaN;
    i *= 1 + (dailyDrawdown - baseDailyDrawdown) * g;
  }
  const c = (payoutShare < baseProfitSplit ? tier.plt : tier.pht) ?? 0;
  i *= 1 + (payoutShare - baseProfitSplit) * c;
  return dailyDrawdown === null ? i : Math.round(i * 100) / 100;
}

/** Prix catalogue d'une combinaison taille / drawdown / payout / perte journaliere (null = pas de choix). */
export function e8Price(product, balance, drawdown, payoutShare, dailyDrawdown = null) {
  let u = product.balances?.[String(balance)]?.price ?? 0;
  if ((product.settings?.pricing ?? []).length > 0) {
    const tier = tierOf(product, balance);
    if (!tier) return 0;
    const baseDrawdown = product.evaluation?.drawdown ?? product.settings.drawdowns?.[0] ?? drawdown;
    const baseProfitSplit = product.settings.payoutShares?.[0] ?? payoutShare;
    u = adjust({ price: u, tier, drawdown, baseDrawdown, payoutShare, baseProfitSplit, dailyDrawdown, baseDailyDrawdown: baseDaily(product) });
  }
  return Math.ceil(u);
}

/** Prix avec code, l'arrondi du site (au dollar superieur). */
export const e8PromoPrice = (price, pct) => (pct <= 0 ? price : Math.ceil((price * (100 - pct)) / 100));

/** Cible / perte journaliere en % : valeur ecrite, sinon multiplicateur x drawdown arrondi a 0,1. */
function derivedPct(product, balance, key, fromKey, drawdown, override) {
  const v = field(product, 'evaluation', key, balance);
  if (v) return v;
  const from = field(product, 'evaluation', fromKey, balance);
  if (!from) return 0;
  let m = from.multiplier;
  if (fromKey === 'dailyDrawdownFrom' && override && override.ids.includes(product.id) && drawdown === override.drawdown) m = override.multiplier;
  if (from.from !== 'drawdown') fail(`${product.id} : ${fromKey} calcule depuis « ${from.from} », base inconnue`);
  return Math.round(drawdown * m * 10) / 10;
}

// ---------------------------------------------------------------------------------------------
// Instantane -> { programs, promo, pairs } (forme exacte de perps-firms.json)
// ---------------------------------------------------------------------------------------------

const DD_TYPES = { dynamic: 'Dynamic', static: 'Static' };
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n) => `${n}%`;
const words = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const PRICE_ORDER = /^Prices for [^.]*? payout, in that order\.\s*/;

/** La phrase qui dit l'ordre des prix, d'apres les payouts du configurateur. */
function priceOrderSentence(shares) {
  return shares.length > 1 ? `Prices for ${words(shares.map(pct))} payout, in that order.` : '';
}

function planNote(previousNote, shares) {
  if (previousNote != null && !PRICE_ORDER.test(previousNote)) return previousNote || undefined;
  const rest = previousNote ? previousNote.replace(PRICE_ORDER, '') : '';
  return [priceOrderSentence(shares), rest].filter(Boolean).join(' ') || undefined;
}

const dllLabel = (d) => (d === 0 ? 'No DLL' : `${d}% DLL`);

/** Un compte du site -> un programme par drawdown propose (« E8 One · 4% Max »…). */
function programsOf(entry, product, discountPct, override, previous) {
  const sizes = sizesOf(product);
  if (!sizes.length) fail(`${entry.name} : aucune taille`);
  const shares = product.settings?.payoutShares ?? [];
  if (!shares.length) fail(`${entry.name} : aucun payout`);
  const drawdowns = product.settings?.drawdowns?.length ? product.settings.drawdowns : [field(product, 'evaluation', 'drawdown', sizes[0])];
  const dailies = dailyOptions(product);
  const mainDaily = dailies.length ? baseDaily(product) : null;
  const otherDailies = dailies.filter((d) => d !== mainDaily);
  if (dailies.length && !dailies.includes(mainDaily)) fail(`${entry.name} : perte journaliere par defaut hors des options`);
  if (otherDailies.length && shares.length > 2) fail(`${entry.name} : options de perte journaliere ET plus de deux payouts, forme du JSON a trancher`);

  const steps = Object.keys(product).filter((k) => /phase|step|evaluation\d/i.test(k));
  if (steps.length) fail(`${entry.name} : phases inattendues (${steps.join(', ')}), nombre d'etapes a relire`);

  return drawdowns.map((dd) => {
    if (!Number.isFinite(dd) || dd <= 0) fail(`${entry.name} : drawdown illisible (${dd})`);
    const name = `${entry.name} · ${dd}% Max`;
    const tag = name;
    // Une regle qui varierait selon la taille n'a pas de place dans un programme du JSON : on s'arrete.
    const same = (what, list) => {
      const vals = [...new Set(list.map((v) => JSON.stringify(v)))];
      if (vals.length !== 1) fail(`${tag} : ${what} change avec la taille (${vals.join(' / ')}), forme a trancher`);
      return JSON.parse(vals[0]);
    };
    const ddType = same('type de drawdown', sizes.map((b) => field(product, 'evaluation', 'drawdownType', b) ?? 'eod'));
    if (!DD_TYPES[ddType]) fail(`${tag} : type de drawdown « ${ddType} » sans libelle connu`);
    const dailyType = same('type de perte journaliere', sizes.map((b) => field(product, 'evaluation', 'dailyDrawdownType', b) ?? 'drawdown'));
    if (dailyType !== 'drawdown') fail(`${tag} : perte journaliere de type « ${dailyType} », libelle a trancher`);
    const target = same('cible', sizes.map((b) => derivedPct(product, b, 'profitTarget', 'profitTargetFrom', dd, override)));
    const daily =
      mainDaily === null ? same('perte journaliere', sizes.map((b) => derivedPct(product, b, 'dailyDrawdown', 'dailyDrawdownFrom', dd, override))) : mainDaily;
    if (!(target > 0)) fail(`${tag} : cible illisible`);

    const prevProgram = previous?.programs?.find((p) => p.name === name) ?? null;
    const priced = (b, share, d) => {
      const price = e8Price(product, b, dd, share, d);
      if (!Number.isFinite(price) || price <= 0 || price > 50000) fail(`${tag} ${b} : prix aberrant (${price})`);
      const promoPrice = e8PromoPrice(price, discountPct);
      if (!Number.isFinite(promoPrice) || promoPrice <= 0 || promoPrice > price) fail(`${tag} ${b} : prix avec code aberrant (${promoPrice})`);
      return { price, promoPrice };
    };

    const plans = sizes.map((b) => {
      const main = priced(b, shares[0], mainDaily);
      const alts = shares.slice(1).map((s) => priced(b, s, mainDaily));
      const plan = { size: b, ...main };
      // Une variante de perte journaliere = une ligne « more » ; dailyLossChoices (lib/daily-loss-choices.mjs)
      // lit altPrice sur ces lignes, d'ou altPrice / altPromoPrice ici (precedent Vest 1-Step).
      if (otherDailies.length) {
        if (alts[0]) Object.assign(plan, { altPrice: alts[0].price, altPromoPrice: alts[0].promoPrice });
      } else if (alts.length) plan.altPrices = alts;
      plan.lines = [{ label: 'Max drawdown', value: money((b * dd) / 100) }];
      if (otherDailies.length) {
        plan.more = otherDailies.map((d) => {
          const m = priced(b, shares[0], d);
          const a = shares[1] != null ? priced(b, shares[1], d) : null;
          return { label: dllLabel(d), ...m, ...(a ? { altPrice: a.price, altPromoPrice: a.promoPrice } : {}) };
        });
      }
      const note = planNote(prevProgram?.plans?.find((p) => p.size === b)?.note, shares);
      if (note) plan.note = note;
      return plan;
    });

    const program = {
      name,
      rulesKey: entry.name.replace(/^E8\s+/, ''),
      steps: '1 step',
      split: shares.map(pct).join(' / '),
      profitTarget: pct(target),
      maxDrawdown: pct(dd),
      ddType: DD_TYPES[ddType],
      dailyLoss: otherDailies.length
        ? `${words(dailies.filter((d) => d !== 0).map(pct))}${dailies.includes(0) ? ' or none' : ''}`.replace(/^ or none$/, 'None')
        : daily > 0
          ? pct(daily)
          : null,
    };
    if (otherDailies.length) program.priceLabel = dllLabel(mainDaily);
    program.note = prevProgram?.note ?? '';
    program.plans = plans;
    return program;
  });
}

/** Libelles et ordre des groupes de symboles, ceux de la page trading-symbols. */
const SYMBOL_ORDER = ['crypto', 'stocks', 'index', 'metals', 'energy', 'fx'];
const SYMBOL_LABEL = { crypto: 'Crypto', stocks: 'Stocks', index: 'Indices', indices: 'Indices', metals: 'Metals', energy: 'Energy', fx: 'FX' };
const symbolLabel = (g) =>
  SYMBOL_LABEL[g.trim().toLowerCase()] ??
  g.split(/[_-]/).filter(Boolean).map((n) => (n.toLowerCase() === 'fx' ? 'FX' : n.charAt(0).toUpperCase() + n.slice(1))).join(' ');

/** { count, title } : nombre de symboles Perpetual et detail par groupe (le plus fourni d'abord, ordre de la page a egalite). */
export function e8PerpsPairs(symbols) {
  const nodes = symbols?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) fail('liste des symboles vide');
  if (Number.isFinite(symbols.totalRows) && symbols.totalRows > nodes.length) fail(`liste des symboles tronquee (${nodes.length} sur ${symbols.totalRows})`);
  const groups = new Map();
  for (const n of nodes) {
    const g = n.group?.trim();
    if (!g) continue;
    const k = g.toLowerCase() === 'indices' ? 'index' : g.toLowerCase();
    groups.set(k, { label: symbolLabel(g), count: (groups.get(k)?.count ?? 0) + 1 });
  }
  const rank = (k) => (SYMBOL_ORDER.includes(k) ? SYMBOL_ORDER.indexOf(k) : SYMBOL_ORDER.length);
  const list = [...groups.entries()].sort(([ka, a], [kb, b]) => b.count - a.count || rank(ka) - rank(kb) || a.label.localeCompare(b.label));
  return { count: nodes.length, title: list.map(([, g]) => `${g.label} ${g.count}`).join(' · ') };
}

/** Remise affichee pour un compte : celle du configurateur, ou un code de la page Discount Codes plus fort. */
function discountOf(product, codes) {
  const first = field(product, 'evaluation', 'firstDiscount', sizesOf(product)[0]);
  const all = field(product, 'evaluation', 'discount', sizesOf(product)[0]);
  const shown = first ?? all ?? 0;
  const listed = (codes ?? []).filter((c) => (c.available_products ?? []).includes(product.id));
  const best = Math.max(shown, ...listed.map((c) => Number(c.percentage_discount) || 0));
  return { pct: best, firstOnly: best === shown && first != null && first !== (all ?? 0) ? { thenPct: all ?? 0 } : null, listed: listed.filter((c) => Number(c.percentage_discount) === best) };
}

/** Fin annoncee en ISO UTC ; une date sans heure ni fuseau ne se devine pas. */
function endOf(listed) {
  if (!listed.length || listed.some((c) => c.expiration_date == null || c.expiration_date === '')) return null;
  const dates = listed.map((c) => String(c.expiration_date));
  for (const d of dates) {
    if (!/T?\d{2}:\d{2}/.test(d) || !/(Z|[+-]\d{2}:?\d{2})$/.test(d) || Number.isNaN(Date.parse(d)))
      fail(`date de fin du code « ${d} » sans heure ou sans fuseau : a trancher`);
  }
  return new Date(Math.max(...dates.map((d) => Date.parse(d)))).toISOString();
}

/** Controle croise : les tuiles rendues par le serveur (programme par defaut) = le calcul. */
function crossCheck(lines, programs, entries, products) {
  if (!lines?.length) return;
  const head = lines.map((l) => /^(.+?) · Account · \$(\d+)K$/.exec(l)).find(Boolean);
  if (!head) return;
  const entry = entries.find((e) => e.name === head[1]);
  if (!entry) fail(`le configurateur affiche « ${head[1]} », absent des comptes Perpetual lus`);
  const product = products[entry.id];
  const dd = product.evaluation?.drawdown ?? product.settings?.drawdowns?.[0];
  const program = programs.find((p) => p.name === `${entry.name} · ${dd}% Max`);
  const isMoney = (l) => /^\$[\d,]+$/.test(l);
  const num = (l) => Number(l.replace(/[$,]/g, ''));
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    const k = /^\$(\d+)K$/.exec(lines[i]);
    if (!k) continue;
    let j = i + 1;
    if (/^recommended$/i.test(lines[j] ?? '')) j++;
    if (!isMoney(lines[j] ?? '') || !isMoney(lines[j + 1] ?? '')) continue;
    const size = Number(k[1]) * 1000;
    const shown = [num(lines[j]), num(lines[j + 1])];
    const plan = program?.plans.find((p) => p.size === size);
    if (!plan || plan.price !== shown[0] || plan.promoPrice !== shown[1])
      fail(`le configurateur affiche ${entry.name} $${k[1]}K a $${shown[0]} / $${shown[1]}, le calcul donne ${plan ? `$${plan.price} / $${plan.promoPrice}` : 'rien'}`);
    seen++;
  }
  return seen;
}

/**
 * Instantane -> { programs, promo, pairs }, forme exacte de l'entree e8-perps de perps-firms.json.
 * `previous` : l'entree e8-perps actuelle du JSON (notes reprises, voir l'en-tete).
 * Leve « E8 perps illisible : … » si l'instantane est incomplet, si le code du site a change ou si un
 * prix sort des bornes.
 */
export function e8PerpsFromSnapshot(snapshot, { checkedOn = new Date().toISOString().slice(0, 10), previous = null } = {}) {
  if (!snapshot || typeof snapshot !== 'object') fail('instantane vide');
  const { products, code, discountCodes } = snapshot;
  if (!products || typeof products !== 'object' || !Object.keys(products).length) fail('aucun compte dans api/data/global');
  for (const k of ['catalog', 'pricing', 'rules']) if (!code?.[k]) fail(`code du configurateur absent (${k})`);
  const catalog = parseCatalog(code.catalog);
  checkPricingCode(code.pricing);
  const { dailyOverride } = parseRulesCode(code.rules, catalog);

  // Les comptes du marche Perpetual, dans l'ordre du configurateur : au catalogue ET vendus (au moins une taille).
  const entries = catalog.entries.filter((e) => e.market === 'perpetual' && sizesOf(products[e.id] ?? {}).length > 0);
  if (!entries.length) fail('aucun compte Perpetual en vente');

  const discounts = Object.fromEntries(entries.map((e) => [e.id, discountOf(products[e.id], discountCodes)]));
  const programs = entries.flatMap((e) => programsOf(e, { ...products[e.id], id: e.id }, discounts[e.id].pct, dailyOverride, previous));
  if (!programs.length) fail('aucun programme');
  crossCheck(snapshot.configurator, programs, entries, products);

  const best = Math.max(...entries.map((e) => discounts[e.id].pct));
  let promo = null;
  if (best > 0) {
    const top = entries.filter((e) => discounts[e.id].pct === best);
    promo = { code: E8_PERPS_CODE, discountPct: best, endsAt: endOf(top.flatMap((e) => discounts[e.id].listed)) };
    const first = top.map((e) => discounts[e.id].firstOnly).find(Boolean);
    if (first) Object.assign(promo, { firstPurchase: true, thenPct: first.thenPct });
    promo.lastChecked = checkedOn;
  }

  const out = { programs, promo };
  if (snapshot.symbols) out.pairs = e8PerpsPairs(snapshot.symbols);
  return out;
}

// ---------------------------------------------------------------------------------------------
// En direct : node scripts/lib/firms/perps-e8.mjs [--profiles safari] [--snapshot <fichier.json>]
// ---------------------------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFile } = await import('node:child_process');
  const fs = await import('node:fs');
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : null;
  };
  const profiles = arg('--profiles');
  const cfGet = new URL('../cf-get.py', import.meta.url).pathname;
  const viaProfiles = (url) =>
    new Promise((resolve, reject) =>
      execFile('python3', [cfGet, url, '--profiles', profiles], { maxBuffer: 64 * 1024 * 1024, timeout: 180_000 }, (err, stdout, stderr) => {
        const status = Number(/^HTTP (\d{3})/m.exec(stderr ?? '')?.[1]);
        if (status >= 200 && status < 300) return resolve(stdout);
        reject(new Error(`HTTP ${status || '?'} sur ${url} (${(stderr || err?.message || '').trim().replace(/\s+/g, ' ')})`));
      }),
    );
  const snapshot = await readE8Perps({ fetchText: profiles ? viaProfiles : fetchPageText });
  const out = arg('--snapshot');
  if (out) fs.writeFileSync(out, `${JSON.stringify(snapshot, null, 1)}\n`);
  const prevFile = arg('--previous');
  const previous = prevFile ? JSON.parse(fs.readFileSync(prevFile, 'utf8')).firms?.find((f) => f.id === 'e8-perps') ?? null : null;
  const checkedOn = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  process.stdout.write(`${JSON.stringify(e8PerpsFromSnapshot(snapshot, { checkedOn, previous }), null, 2)}\n`);
}
