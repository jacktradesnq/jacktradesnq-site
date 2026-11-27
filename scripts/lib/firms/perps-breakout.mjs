/**
 * Breakout (perps, id `breakout` de public/data/perps-firms.json), lu sur leur site public.
 *
 * Page lue : https://www.breakoutprop.com/pricing/ (breakoutprop.com y renvoie en 301). WordPress
 * derrière Cloudflare : le 28/11/2026 un fetch Node reçoit 403, curl_cffi passe (profils chrome
 * et safari, depuis la maison) ; le Chromium headless est bloqué. Rien ici ne demande un
 * navigateur : tout ce que le visiteur voit est dans le HTML.
 *
 * 1. Les plans. La grille de prix est rendue en JS (assets/js/homepage.js) depuis des données
 *    embarquées dans la page :
 *
 *      window.breakoutHomepageData = {"plans":[{"id":"1step","name":"1-Step Classic","target":"10%",
 *        "dailyLoss":"3%","drawdown":"6%","leverage":"10x","phases":"1",
 *        "sizes":{"5000":{"p":45,"u":54,"pid":"…"}, …}}, …], "spark":{"enabled":false, …}};
 *
 *    Chaque carte affiche p (« one-time, 80/20 split »), « Upgrade to 90/10 split: $X » (p × 1,2),
 *    « Max drawdown <drawdown> static » (homepage.js ajoute « static » à chaque plan), et une
 *    taille absente du plan donne « N/A ». Le même contenu est servi sans JS dans un tableau
 *    <noscript> (« Not offered » pour Classic 200K) : il est relu et doit dire la même chose.
 *    Le split vient de sa légende (« Every evaluation includes an 80/20 profit split; the 90/10
 *    upgrade at checkout costs 20% more. »), le type de drawdown de spark.coreSub (« Static
 *    drawdown, $5k-200k » pour « Classic, Pro & Turbo »).
 *
 * 2. La promo. Une bannière en haut de page, affichée par un script entre data-start et data-end :
 *
 *      <a id="lp24-banner" hidden href="/lp/bfcm25" data-start="1795777320000" data-end="1796082900000"
 *         aria-label="NEW: 50% OFF TRADING FEES &amp; 25% OFF EVALUATIONS FOR BLACK FRIDAY WEEKEND">
 *
 *    Sa page (lue seulement si la bannière existe) porte un JSON de configuration
 *    (<script id="bf-config" type="application/json">) : prix des évaluations en centimes
 *    [catalogue, remisé] par plan et par taille, « off » (« BFCM25, 25% off »), « heroDate »
 *    (« Promotion will terminate on 30 November, 23:59 UTC. »), et sa phase est écrite dans le HTML
 *    (<div class="bf" data-bf data-offer="friday">) : en « cyber » ou « ended », la page n'applique
 *    plus de remise aux évaluations (seulement aux frais de trading).
 *
 * Règles d'Angelo appliquées ici :
 *  - le code imprimé est TOUJOURS JTNQ ; la meilleure remise affichée par la firme lui est
 *    attribuée ; leur code public est lu pour rien et jamais rendu ;
 *  - hors promo affichée, JTNQ vaut le taux d'un code créateur que publie leur page affiliés
 *    (breakoutprop.com/affiliates/, 28/11/2026 : « Anyone using your code gets 5% off their first
 *    order »), sans date de fin, au premier achat (Angelo, 01/11/2026 : « breakout premier eval c'est
 *    belle et bien du 5% ») ; phrase introuvable = firme illisible ;
 *  - promoPrice = le prix remisé que la page affiche quand elle en affiche un, sinon prix × (1 − taux)
 *    au centime (« Checkout prices include cents », conditions de la promo du 27/11/2026) ;
 *  - un plan que la firme ajoute ou retire apparaît / disparaît seul (28/11/2026) : le nom affiché
 *    est celui du site sans son préfixe d'étapes (« 1-Step Classic » -> « Classic », les étapes
 *    vont dans `steps`) ;
 *  - `note` : la page n'en porte pas ; celle du JSON précédent (option `previous`) est gardée,
 *    sinon vide.
 *  - le 90/10 (« the 90/10 upgrade at checkout costs 20% more », « Upgrade to 90/10 split: $X » sur
 *    chaque carte) = second prix de la case après un « / », split « 80% / 90% », comme Vest et E8 One
 *    (Angelo, 12/10/2026 : « dans la même colonne et dans chaque truc t'as un / qui met les 2 prix ») ;
 *    prix = celui de la carte (prix × 1,2 au centime), avec le code = ce prix − la remise, au centime.
 * Ce que la page montre et que la forme du JSON ne sait pas porter n'est pas rendu (frais de trading
 *    de la promo : aucune colonne du site ne montre de frais de trading) ; Spark affiché sur /pricing/
 *    arrête la firme : comment le caser n'est pas tranché.
 */
import { fetchPageText } from '../cf-fetch.mjs';

export const BREAKOUT_PERPS_SOURCE = 'https://www.breakoutprop.com/pricing/';
export const BREAKOUT_CODE = 'JTNQ';
/** Page affiliés : le taux d'un code créateur hors promo (« Anyone using your code gets 5% off their first order »). */
export const BREAKOUT_AFFILIATES = 'https://www.breakoutprop.com/affiliates/';


const fail = (why) => {
  throw new Error(`Breakout illisible : ${why}`);
};

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#039;': "'", '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ', '&#160;': ' ' };
const decode = (s) => String(s).replace(/&(?:amp|quot|lt|gt|#0?39|#x27|nbsp|#160);/g, (m) => ENTITIES[m]);
const text = (s) =>
  decode(String(s).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
};

/** « $1,090 » -> 1090 ; « Not offered » -> null. */
export function money(s) {
  const m = String(s ?? '').match(/\$\s*(\d[\d,]*(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

const cents = (x) => Math.round(x * 100) / 100;
const discounted = (price, pct) => Math.round(price * (100 - pct)) / 100;

/** L'objet JSON affecté à `window.<name>` dans la page, ou null. */
function windowJson(html, name) {
  const marker = `window.${name}`;
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const start = html.indexOf('{', at + marker.length);
  if (start === -1 || !/^\s*=\s*$/.test(html.slice(at + marker.length, start))) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Le contenu d'un <script id="…" type="application/json">, ou null. */
function scriptJson(html, id) {
  const m = html.match(new RegExp(`<script[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** La bannière de promo de /pricing/ : { href, start, end, label, html } ou null. */
export function breakoutBanner(html) {
  const at = html.search(/<a\b[^>]*\sid="lp24-banner"/);
  if (at === -1) return null;
  const tag = html.slice(at, html.indexOf('>', at) + 1);
  const close = html.indexOf('</a>', at);
  const start = Number(attr(tag, 'data-start'));
  const end = Number(attr(tag, 'data-end'));
  return {
    href: attr(tag, 'href'),
    start: Number.isFinite(start) && start > 0 ? start : 0,
    end: Number.isFinite(end) && end > 0 ? end : Infinity,
    label: attr(tag, 'aria-label') ?? text(html.slice(at, close === -1 ? undefined : close)),
    html: html.slice(at, close === -1 ? at + tag.length : close + 4),
  };
}

/** Le texte visible de la page, sans scripts, styles ni bannière. */
function visibleText(html, banner) {
  const body = banner ? html.replace(banner.html, ' ') : html;
  return text(body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript>|<\/noscript>/g, ' '));
}

/** Le tableau <noscript> : { caption, rows: [{ name, target, dailyLoss, drawdown, prices: { size: price|null } }] } ou null. */
function noscriptTable(html) {
  const m = html.match(/<div class="bk-price-noscript">([\s\S]*?)<\/table>/);
  if (!m) return null;
  const t = m[1];
  const caption = text(t.match(/<caption>([\s\S]*?)<\/caption>/)?.[1] ?? '');
  const heads = [...t.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)].map((x) => text(x[1]));
  const col = (label) => heads.findIndex((h) => h.toLowerCase() === label) - 1; // la 1re colonne est un <th scope="row">
  const [iTarget, iDaily, iDd] = ['profit target', 'max daily loss', 'max drawdown'].map(col);
  const sizeCols = heads.map((h, i) => [h.match(/^\$([\d,]+) account$/i), i - 1]).filter(([s]) => s);
  const rows = [...t.matchAll(/<tr>\s*<th scope="row">([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/g)].map((r) => {
    const cells = [...r[2].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => text(c[1]));
    return {
      name: text(r[1]),
      target: cells[iTarget],
      dailyLoss: cells[iDaily],
      drawdown: cells[iDd],
      prices: Object.fromEntries(sizeCols.map(([s, i]) => [Number(s[1].replace(/,/g, '')), money(cells[i])])),
    };
  });
  return { caption, rows };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * « Promotion will terminate on 30 November, 23:59 UTC. » -> '2026-11-30T23:59:00Z'. La page ne
 * donne pas l'année : celle qui met la date au plus près de la lecture (`at`, ms).
 */
export function breakoutEndsAt(sentence, at) {
  const m = String(sentence ?? '').match(/(\d{1,2})\s+([A-Za-z]+),?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*UTC/i);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (!m || month === -1) return null;
  const year = new Date(at).getUTCFullYear();
  const best = [year - 1, year, year + 1]
    .map((y) => Date.UTC(y, month, Number(m[1]), Number(m[3]), Number(m[4])))
    .reduce((a, b) => (Math.abs(b - at) < Math.abs(a - at) ? b : a));
  return new Date(best).toISOString().replace('.000Z', 'Z');
}

const shortName = (name) => String(name).replace(/^\s*\d+\s*-?\s*steps?\s+/i, '').trim();

/** Les plans de /pricing/ : [{ id, siteName, name, steps, profitTarget, maxDrawdown, dailyLoss, plans: [{ size, price }] }]. */
function plansOf(hp) {
  if (!Array.isArray(hp?.plans) || hp.plans.length === 0) fail('aucun plan dans window.breakoutHomepageData');
  return hp.plans.map((p, i) => {
    const siteName = String(p?.name ?? '').trim();
    const name = shortName(siteName);
    if (!siteName || !name) fail(`plan ${i} sans nom`);
    const phases = Number(p.phases ?? siteName.match(/^(\d+)\s*-?\s*step/i)?.[1]);
    if (!Number.isInteger(phases) || phases < 1) fail(`${siteName} : nombre d'étapes illisible`);
    const rule = (key) => {
      const v = typeof p[key] === 'string' ? p[key].trim() : '';
      if (!/\d/.test(v)) fail(`${siteName} : « ${key} » illisible (${JSON.stringify(p[key])})`);
      return v;
    };
    const sizes = Object.entries(p.sizes ?? {});
    if (sizes.length === 0) fail(`${siteName} : aucune taille`);
    const plans = sizes
      .map(([key, d]) => {
        const size = Number(key);
        if (!Number.isInteger(size) || size < 1000 || size > 1_000_000) fail(`${siteName} : taille « ${key} » illisible`);
        const extra = Object.keys(d ?? {}).filter((k) => !['p', 'u', 'pid'].includes(k));
        if (extra.length) fail(`${siteName} ${size} : champ inconnu ${extra.join(', ')} (une remise ?)`);
        const price = d?.p;
        if (typeof price !== 'number' || !Number.isFinite(price)) fail(`${siteName} ${size} : prix manquant`);
        if (price < 5 || price > 10_000 || price / size > 0.05 || price / size < 0.0005)
          fail(`${siteName} ${size} : prix aberrant ($${price})`);
        return { size, price };
      })
      .sort((a, b) => a.size - b.size);
    return {
      id: p.id,
      siteName,
      name,
      steps: phases === 1 ? '1 step' : `${phases} steps`,
      profitTarget: rule('target'),
      maxDrawdown: rule('drawdown'),
      dailyLoss: rule('dailyLoss'),
      plans,
    };
  });
}

/** Le tableau <noscript> doit dire la même chose que les données embarquées. */
function checkTable(table, plans) {
  if (!table) return;
  if (table.rows.length !== plans.length) fail(`tableau <noscript> : ${table.rows.length} plans, ${plans.length} dans les données`);
  for (const row of table.rows) {
    const p = plans.find((x) => x.siteName === row.name);
    if (!p) fail(`tableau <noscript> : plan « ${row.name} » absent des données`);
    for (const [k, v] of [['target', p.profitTarget], ['dailyLoss', p.dailyLoss], ['drawdown', p.maxDrawdown]])
      if (row[k] !== v) fail(`${row.name} : ${k} « ${row[k]} » dans le tableau, « ${v} » dans les données`);
    for (const [size, price] of Object.entries(row.prices)) {
      const plan = p.plans.find((x) => x.size === Number(size));
      if ((plan?.price ?? null) !== price) fail(`${row.name} ${size} : $${price} dans le tableau, $${plan?.price ?? '—'} dans les données`);
    }
  }
}

/** « the 90/10 upgrade at checkout costs 20% more » -> { split: 90, factor: 1.2 } ; null si la page n'en parle pas. */
function upgradeOf(table, pageText) {
  const m = [table?.caption ?? '', pageText].join(' ').match(/(\d{1,3})\/(\d{1,3}) upgrade at checkout costs (\d{1,3})% more/i);
  return m ? { split: Number(m[1]), factor: 1 + Number(m[3]) / 100 } : null;
}

/** « 80/20 » de la page -> « 80% ». */
function splitOf(table, pageText) {
  const m =
    table?.caption.match(/(\d{1,3})\/(\d{1,3}) profit split/i) ??
    pageText.match(/includes an? (\d{1,3})\/(\d{1,3}) profit split/i) ??
    pageText.match(/(\d{1,3})\/(\d{1,3}) is the standard on every plan/i);
  if (!m) fail('split illisible (« 80/20 profit split » introuvable)');
  return `${m[1]}%`;
}

/** « Static drawdown, $5k-200k » -> « Static ». */
function ddTypeOf(hp, v2) {
  const fromCore = String(hp?.spark?.coreSub ?? '').match(/^\s*(static|trailing)\s+drawdown/i)?.[1];
  const fromFinder = String(v2?.sparkFinder?.static_suffix ?? '').match(/^\s*(static)\s*$/i)?.[1];
  const word = fromCore ?? fromFinder;
  if (!word) fail('type de drawdown illisible (spark.coreSub, sparkFinder.static_suffix)');
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * La promo de la page de la bannière, si la remise sur les évaluations y court à `at` :
 * { pct, endsAt, prices: { [name]: { [size]: { list, promo } } } } ; null sinon.
 */
function landingPromo(landing, banner, at) {
  if (!landing?.html) fail(`bannière promo affichée (« ${banner.label} ») mais sa page ${landing?.url ?? banner.href} est illisible${landing?.error ? ` : ${landing.error}` : ''}`);
  const cfg = scriptJson(landing.html, 'bf-config');
  const phase = landing.html.match(/<div[^>]*\sdata-bf\b[^>]*\sdata-offer="([^"]+)"/)?.[1];
  if (!cfg?.prices || !phase) fail(`bannière promo affichée (« ${banner.label} ») mais ${landing.url} sans bf-config ni data-offer lisibles`);
  if (phase !== 'friday') return null; // « cyber » / « ended » : plus de remise sur les évaluations
  const pct = Number(String(cfg.off ?? '').match(/(\d{1,2}(?:\.\d+)?)\s*% off/i)?.[1] ?? text(landing.html).match(/(\d{1,2}(?:\.\d+)?)% off with\b/i)?.[1]);
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) fail(`${landing.url} : taux de remise illisible (« ${cfg.off} »)`);
  const endsAt = breakoutEndsAt(cfg.heroDate ?? text(landing.html).match(/Promotion will terminate on [^.]*\./i)?.[0], at);
  if (!endsAt) fail(`${landing.url} : date de fin illisible (« ${cfg.heroDate} »)`);
  if (Date.parse(endsAt) <= at) return null; // annoncée, finie
  const prices = {};
  for (const [key, bySize] of Object.entries(cfg.prices)) {
    const name = String(cfg.planNames?.[key] ?? key);
    prices[name.toLowerCase()] = {};
    for (const [label, pair] of Object.entries(bySize ?? {})) {
      const k = String(label).match(/^(\d+(?:\.\d+)?)\s*k$/i);
      if (!k || !Array.isArray(pair) || pair.length < 2 || !pair.every((c) => Number.isFinite(c) && c > 0)) fail(`${landing.url} : prix ${name} ${label} illisible`);
      const list = pair[0] / 100;
      const promo = pair[1] / 100;
      if (Math.abs(promo - list * (1 - pct / 100)) > 1) fail(`${landing.url} : ${name} ${label} à $${promo} au lieu de $${list} − ${pct} %`);
      prices[name.toLowerCase()][Math.round(Number(k[1]) * 1000)] = { list, promo };
    }
  }
  return { pct, endsAt, prices };
}

/**
 * Le snapshot -> { programs, promo } dans la forme exacte de public/data/perps-firms.json.
 * checkedOn : date du relevé (« 2026-11-28 ») ; previous : l'entrée breakout du JSON actuel (ou
 * { programs }) pour en garder les `note`. Lève « Breakout illisible : … » si la page est illisible
 * ou incomplète.
 */
export function breakoutPerpsFromSnapshot(snapshot, { checkedOn, previous } = {}) {
  const html = snapshot?.pricing?.html;
  if (typeof html !== 'string' || html.length < 1000) fail('page /pricing/ absente ou vide');
  const at = Date.parse(snapshot.fetchedAt ?? (checkedOn ? `${checkedOn}T12:00:00Z` : ''));
  if (!Number.isFinite(at)) fail('heure de lecture inconnue (fetchedAt)');
  const day = checkedOn ?? new Date(at).toISOString().slice(0, 10);

  const hp = windowJson(html, 'breakoutHomepageData');
  if (!hp) fail('window.breakoutHomepageData introuvable');
  if (hp.spark?.enabled === true)
    fail(`Spark affiché sur /pricing/ (« ${hp.spark.sparkLabel ?? 'Spark'} », ${hp.spark.state ?? 'état inconnu'}) : sa forme dans le JSON reste à décider`);
  const v2 = windowJson(html, 'breakoutPricingV2Data');
  const banner = breakoutBanner(html);
  const pageText = visibleText(html, banner);
  const offText = pageText.match(/[^.]{0,60}\b\d{1,2}\s*%\s*off\b[^.]{0,60}/i);
  if (offText) fail(`remise affichée hors de la bannière connue : « ${offText[0].trim()} »`);

  const plans = plansOf(hp);
  const table = noscriptTable(html);
  checkTable(table, plans);
  const upgrade = upgradeOf(table, pageText);
  const split = upgrade ? splitOf(table, pageText) + ' / ' + upgrade.split + '%' : splitOf(table, pageText);
  const ddType = ddTypeOf(hp, v2);

  const bannerOn = banner && banner.start <= at && at < banner.end;
  const live = bannerOn ? landingPromo(snapshot.promo, banner, at) : null;
  const standard = breakoutCreatorPct(snapshot.affiliates);
  const pct = live && live.pct > standard ? live.pct : standard;
  const promo =
    pct === standard
      ? { code: BREAKOUT_CODE, discountPct: pct, endsAt: null, firstPurchase: true, lastChecked: day }
      : { code: BREAKOUT_CODE, discountPct: pct, endsAt: live.endsAt, lastChecked: day };

  const notes = new Map((previous?.programs ?? []).map((p) => [p.name, p.note ?? '']));
  const programs = plans.map((p) => ({
    name: p.name,
    steps: p.steps,
    split,
    profitTarget: p.profitTarget,
    maxDrawdown: p.maxDrawdown,
    ddType,
    dailyLoss: p.dailyLoss,
    note: notes.get(p.name) ?? '',
    plans: p.plans.map(({ size, price }) => {
      let promoPrice = discounted(price, pct);
      if (promo.endsAt != null) {
        const shown = live.prices[p.name.toLowerCase()]?.[size];
        if (shown && shown.list !== price) fail(`${p.name} ${size} : $${price} sur /pricing/, $${shown.list} sur ${snapshot.promo.url}`);
        if (shown) promoPrice = cents(shown.promo);
      }
      if (!upgrade) return { size, price, promoPrice };
      const altPrice = cents(price * upgrade.factor);
      return { size, price, promoPrice, altPrice, altPromoPrice: discounted(altPrice, pct) };
    }),
  }));
  return { programs, promo };
}

/**
 * Lit le site : /pricing/, puis la page de sa bannière de promo si elle en a une (une page de
 * promo illisible est gardée avec son erreur : elle ne compte que si la bannière est affichée).
 * fetchText(url) -> texte ; par défaut fetch puis curl_cffi sur 403 (scripts/lib/cf-fetch.mjs).
 * chromium : inutile ici (Cloudflare bloque le Chromium headless, et tout est dans le HTML).
 */
export async function readBreakoutPerps({ fetchText = (url) => fetchPageText(url), chromium, now = () => new Date() } = {}) {
  void chromium;
  const fetchedAt = now().toISOString();
  const html = await fetchText(BREAKOUT_PERPS_SOURCE);
  const snapshot = { source: BREAKOUT_PERPS_SOURCE, fetchedAt, pricing: { url: BREAKOUT_PERPS_SOURCE, html }, promo: null };
  const banner = typeof html === 'string' ? breakoutBanner(html) : null;
  if (banner?.href) {
    const url = new URL(banner.href, BREAKOUT_PERPS_SOURCE).href;
    if (!/(^|\.)breakoutprop\.com$/.test(new URL(url).hostname)) snapshot.promo = { url, error: 'hors de breakoutprop.com, non lue' };
    else {
      try {
        snapshot.promo = { url, html: await fetchText(url) };
      } catch (e) {
        snapshot.promo = { url, error: e.message };
      }
    }
  }
  try {
    snapshot.affiliates = { url: BREAKOUT_AFFILIATES, html: await fetchText(BREAKOUT_AFFILIATES) };
  } catch (e) {
    snapshot.affiliates = { url: BREAKOUT_AFFILIATES, error: e.message };
  }
  return snapshot;
}

/** Le taux d'un code créateur hors promo, lu sur la page affiliés du snapshot. */
export function breakoutCreatorPct(affiliates) {
  if (!affiliates?.html) fail(`page affiliés ${affiliates?.url ?? BREAKOUT_AFFILIATES} illisible${affiliates?.error ? ` : ${affiliates.error}` : ''}`);
  const m = text(affiliates.html).match(/Anyone using your code gets (\d{1,2}(?:\.\d+)?)% off their first order/i);
  if (!m) fail('page affiliés : « Anyone using your code gets X% off their first order » introuvable');
  return Number(m[1]);
}
