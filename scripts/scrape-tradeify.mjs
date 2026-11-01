#!/usr/bin/env node
/**
 * Relecture quotidienne de Tradeify pour le comparateur (public/data/compare-extra-firms.json).
 *
 * Demande d'Angelo, 01/11/2026, sur le code public GEMS qui expirait le soir même :
 * « quand c'est expiré check tous les jours jusqu'à ce qu'il y ait le bon code ».
 *
 * tradeify.co répond 200 à un simple fetch avec un User-Agent navigateur. Les cartes de prix
 * sont dessinées par leur JS à partir de trois objets écrits dans le HTML :
 *   const GrowthData / SelectData / LightningData = [{ broker: [{ broker_name, account_size:
 *     [{ name: '25K', price: 99, couponCode: 'growth', showFraction: false, ... }] }] }]
 *   const couponDetails = { default_code: ['GEMS', 30], growth: ['GEMS', 30], ... }
 *   const couponInfo = { lastDay: '31', month: 'OCTOBER', time: '11:59PM EST', monthlyCode: 'GEMS' }
 * Prix affiché = formatPriceValue(price × (100 − remise) / 100), barré = price ; remise 0 = ni
 * code ni prix barré (leur getDiscountValue). Une plateforme (Tradovate, WealthCharts, Tradesea)
 * dont les prix diffèrent arrête la relecture plutôt que d'en choisir une.
 *
 * Met à jour, pour Tradeify seulement : promo (libellé, code, date de fin si affichée), code, les
 * 12 prix (price / originalPrice de Growth, Select, Lightning × 25K/50K/100K/150K), lastChecked.
 * Les règles des plans restent écrites à la main. Lucid Trading n'est pas relu (403 Cloudflare).
 *
 * Trois sorties, distinctes dans les logs :
 *   « OK — rien n'a changé »            code 0
 *   « OK — N changement(s) »            code 0
 *   « ÉCHEC — … stale: true »           code 1 : page illisible ou moins de 12 prix ; les données
 *                                        ne bougent pas, seule la firme passe stale: true.
 *
 *   node scripts/scrape-tradeify.mjs           relit et écrit
 *   node scripts/scrape-tradeify.mjs --dry     relit, n'écrit rien
 *   node scripts/scrape-tradeify.mjs --dry --url=https://tradeify.co/nope   provoque l'ÉCHEC
 */

import fs from 'node:fs';

export const TRADEIFY_URL = 'https://tradeify.co/';
const DATA_URL = new URL('../public/data/compare-extra-firms.json', import.meta.url);
const FIRM_ID = 'tradeify';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Programme du JSON -> objet de données de leur page. */
export const TRADEIFY_PROGRAMS = { Growth: 'GrowthData', Select: 'SelectData', Lightning: 'LightningData' };
export const TRADEIFY_SIZES = [25000, 50000, 100000, 150000];
const EXPECTED = Object.keys(TRADEIFY_PROGRAMS).length * TRADEIFY_SIZES.length; // 12

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/** Leur arrondi (formatPriceValue) : ,5 et plus vers le haut. */
export function formatPriceValue(value, showFraction) {
  const num = Number(value);
  if (showFraction) return Number(num.toFixed(2));
  return num - Math.floor(num) >= 0.5 ? Math.ceil(num) : Math.floor(num);
}

/** Le texte d'un `const <name> = …` jusqu'à la fin de son <script>. */
function scriptBlock(html, name) {
  const start = html.search(new RegExp(`const\\s+${name}\\s*=`));
  if (start < 0) return null;
  const end = html.indexOf('</script>', start);
  return html.slice(start, end < 0 ? undefined : end);
}

/** couponDetails : { clé: [code, remise %] }. */
export function parseCouponDetails(html) {
  const block = scriptBlock(html, 'couponDetails');
  if (!block) throw new Error('couponDetails introuvable dans la page');
  const body = block.slice(0, block.indexOf('};') + 1);
  const out = {};
  for (const m of body.matchAll(/(\w+)\s*:\s*\[\s*'([^']*)'\s*,\s*([\d.]+)\s*\]/g)) out[m[1].toLowerCase()] = [m[2].toUpperCase(), Number(m[3])];
  if (!out.default_code) throw new Error('couponDetails sans default_code');
  return out;
}

/** Leur getDiscountValue : clé inconnue = default_code. */
const couponOf = (coupons, key) => coupons[String(key ?? '').toLowerCase()] ?? coupons.default_code;

/** isVisible: true / false, ou le nom d'une constante de la page (is300visible = false). */
function visible(html, chunk) {
  const v = chunk.match(/isVisible:\s*(\w+)/)?.[1] ?? 'true';
  if (v === 'true' || v === 'false') return v === 'true';
  const c = html.match(new RegExp(`(?:const|let|var)\\s+${v}\\s*=\\s*(true|false)`));
  return c ? c[1] === 'true' : true;
}

/** Les comptes en vente d'une plateforme : [{ size, price, couponCode, showFraction }]. */
function accountsOf(html, brokerText) {
  const marks = [...brokerText.matchAll(/name:\s*'(\d+(?:\.\d+)?)K'/g)];
  return marks.flatMap((m, i) => {
    const chunk = brokerText.slice(m.index, marks[i + 1]?.index);
    const price = chunk.match(/\bprice:\s*([\d.]+)/);
    const head = chunk.slice(0, price?.index ?? chunk.length); // avant multiConsistencyData
    if (!visible(html, head)) return [];
    return [{
      size: Math.round(Number(m[1]) * 1000),
      price: price ? Number(price[1]) : NaN,
      couponCode: chunk.match(/couponCode:\s*'([^']*)'/)?.[1] ?? null,
      showFraction: /showFraction:\s*true/.test(head),
    }];
  });
}

/** Prix catalogue par taille d'un programme, identiques sur toutes les plateformes. */
function programAccounts(html, programName) {
  const varName = TRADEIFY_PROGRAMS[programName];
  const block = scriptBlock(html, varName);
  if (!block) throw new Error(`${varName} introuvable dans la page`);
  const brokers = block.split(/broker_name\s*:/).slice(1);
  if (!brokers.length) throw new Error(`${varName} : aucune plateforme`);
  const [first, ...others] = brokers.map((b) => accountsOf(html, b));
  for (const other of others)
    for (const a of first) {
      const b = other.find((x) => x.size === a.size);
      if (b && (b.price !== a.price || b.couponCode !== a.couponCode))
        throw new Error(`${programName} $${a.size / 1000}K : prix différents selon la plateforme (${a.price} / ${b.price})`);
    }
  return first;
}

/** Décalage de New York à cette date (« EST » écrit par eux = heure de New York). */
function newYorkOffset(utcGuessMs) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' })
    .formatToParts(new Date(utcGuessMs))
    .find((p) => p.type === 'timeZoneName').value; // « GMT-04:00 »
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? `${m[1]}${m[2]}:${m[3]}` : '+00:00';
}

/**
 * Date de fin affichée (couponInfo), en ISO avec le décalage de New York, si elle vaut pour ce
 * code. Pas d'année sur leur page : celle qui met la date le plus près de `now`.
 * @returns {{ ends: string | null, note: string | null }}
 */
export function parseEnds(html, code, now) {
  const block = scriptBlock(html, 'couponInfo');
  if (!block) return { ends: null, note: 'pas de couponInfo, pas de date de fin' };
  const field = (k) => block.match(new RegExp(`${k}\\s*:\\s*'([^']*)'`))?.[1] ?? null;
  const shownCode = field('monthlyCode')?.toUpperCase();
  if (shownCode !== code) return { ends: null, note: `date de fin écrite pour ${shownCode ?? '?'}, pas pour ${code} : ignorée` };
  const day = Number(field('lastDay'));
  const month = MONTHS.indexOf(String(field('month')).toUpperCase());
  const t = String(field('time')).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!day || month < 0 || !t) return { ends: null, note: `date de fin illisible (${field('lastDay')} ${field('month')} ${field('time')})` };
  const hh = (Number(t[1]) % 12) + (t[3].toUpperCase() === 'PM' ? 12 : 0);
  const pad = (n) => String(n).padStart(2, '0');
  const at = (year) => {
    const local = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hh)}:${t[2]}:00`;
    const iso = local + newYorkOffset(Date.parse(`${local}Z`));
    return { iso, ms: Date.parse(iso) };
  };
  const year = new Date(now).getUTCFullYear();
  const best = [year - 1, year, year + 1].map(at).sort((a, b) => Math.abs(a.ms - now) - Math.abs(b.ms - now))[0];
  if (best.ms <= now) return { ends: null, note: `date de fin affichée déjà passée (${best.iso}) : ignorée` };
  return { ends: best.iso, note: null };
}

/**
 * Ce que la page affiche : les 12 prix (avec et sans code) et le code public.
 * Lève une erreur dès que quelque chose manque : jamais de relecture partielle.
 */
export function parseTradeify(html, now = Date.now()) {
  if (typeof html !== 'string' || html.length < 1000) throw new Error('page vide ou tronquée');
  const coupons = parseCouponDetails(html);
  const plans = [];
  const notices = [];
  for (const programName of Object.keys(TRADEIFY_PROGRAMS)) {
    for (const a of programAccounts(html, programName)) {
      if (!TRADEIFY_SIZES.includes(a.size)) {
        notices.push(`vendu chez eux, pas dans notre JSON (pas ajouté) : ${programName} $${a.size / 1000}K (${a.price})`);
        continue;
      }
      const [code, pct] = couponOf(coupons, a.couponCode);
      if (pct > 0 && (!code || code === 'NONE')) throw new Error(`${programName} $${a.size / 1000}K : remise ${pct} % sans code`);
      plans.push({
        programName,
        size: a.size,
        price: pct > 0 ? formatPriceValue((a.price * (100 - pct)) / 100, a.showFraction) : a.price,
        originalPrice: a.price,
        code: pct > 0 ? code : null,
        pct: pct > 0 ? pct : 0,
      });
    }
  }
  for (const p of plans) {
    if (!Number.isFinite(p.price) || !Number.isFinite(p.originalPrice))
      throw new Error(`${p.programName} $${p.size / 1000}K : prix illisible`);
    if (p.price < 10 || p.originalPrice > 6000)
      throw new Error(`${p.programName} $${p.size / 1000}K : prix ${p.price}/${p.originalPrice} hors de [10, 6000]`);
  }
  const missing = Object.keys(TRADEIFY_PROGRAMS).flatMap((pr) =>
    TRADEIFY_SIZES.filter((s) => !plans.some((p) => p.programName === pr && p.size === s)).map((s) => `${pr} $${s / 1000}K`),
  );
  if (plans.length < EXPECTED || missing.length)
    throw new Error(`${plans.length}/${EXPECTED} prix trouvés${missing.length ? ` (manquent : ${missing.join(', ')})` : ''}`);

  // Les firmes varient leurs promos d'un programme à l'autre (Angelo, 01/11/2026 : « c très commun
  // chez les propfirm ») : même code à remises différentes (NOV : Growth -40 %, le reste -30 %), ou
  // un code par programme. Seuls plusieurs codes dans un même programme se relisent à la main : une
  // ligne du comparateur par compte, mais un seul code par programme dans le JSON.
  const labelOf = (list, c) => {
    const pcts = list.map((p) => p.pct);
    const [low, high] = [Math.min(...pcts), Math.max(...pcts)];
    return `${low === high ? high : `${low}-${high}`}% off with code ${c}`;
  };
  const offers = {};
  for (const programName of Object.keys(TRADEIFY_PROGRAMS)) {
    const own = plans.filter((p) => p.programName === programName);
    const ownCodes = new Set(own.map((p) => p.code ?? '—'));
    if (ownCodes.size > 1) throw new Error(`${programName} : plusieurs codes dans le même programme (${[...ownCodes].join(' | ')}) : à relire à la main`);
    if (own[0].code) offers[programName] = { code: own[0].code, label: labelOf(own, own[0].code) };
  }
  const allCodes = new Set(plans.map((p) => p.code));
  const code = allCodes.size === 1 ? plans[0].code : null;
  let promo = null;
  if (code) {
    const { ends, note } = parseEnds(html, code, now);
    if (note) notices.push(note);
    promo = { label: labelOf(plans, code), code, ...(ends ? { ends } : {}) };
  } else {
    // Plusieurs codes : leur date de fin ne vaut que pour celui qu'elle nomme.
    for (const c of allCodes) {
      const { ends } = c ? parseEnds(html, c, now) : { ends: null };
      if (ends) promo = { label: labelOf(plans.filter((p) => p.code === c), c), code: c, ends };
    }
  }
  const banner = html.match(/(\d+)% Off with code (?:&quot;|")(\w+)(?:&quot;|")/i);
  if (code && banner && banner[2].toUpperCase() !== code)
    notices.push(`le bandeau dit « ${banner[0]} », les cartes appliquent ${code}`);
  return { promo, code, plans, notices, offers: allCodes.size > 1 ? offers : {} };
}

/**
 * Applique une relecture à la firme (copie modifiée en place). Renvoie la liste des changements.
 */
export function applyTradeify(firm, read, today) {
  const changes = [];
  const before = JSON.stringify(firm.promo ?? null);
  if (before !== JSON.stringify(read.promo)) {
    changes.push(`promo ${before} -> ${JSON.stringify(read.promo)}`);
    firm.promo = read.promo;
  }
  if ((firm.code ?? null) !== read.code) {
    changes.push(`code ${firm.code ?? null} -> ${read.code}`);
    firm.code = read.code;
  }
  for (const program of firm.programs) {
    const offer = read.offers?.[program.name] ?? null;
    if ((program.promoCode ?? null) !== (offer?.code ?? null) || (program.promoLabel ?? null) !== (offer?.label ?? null)) {
      changes.push(`${program.name} : code ${program.promoCode ?? null} -> ${offer?.code ?? null}`);
      if (offer) Object.assign(program, { promoCode: offer.code, promoLabel: offer.label });
      else {
        delete program.promoCode;
        delete program.promoLabel;
      }
    }
    for (const plan of program.plans) {
      const u = read.plans.find((p) => p.programName === program.name && p.size === plan.size);
      if (!u) continue; // un plan du JSON que la page ne vend plus : parseTradeify a déjà levé
      const tag = `${program.name} $${plan.size / 1000}K`;
      if (plan.price !== u.price) {
        changes.push(`${tag} : price ${plan.price} -> ${u.price}`);
        plan.price = u.price;
      }
      if (plan.originalPrice !== u.originalPrice) {
        changes.push(`${tag} : originalPrice ${plan.originalPrice} -> ${u.originalPrice}`);
        plan.originalPrice = u.originalPrice;
      }
    }
  }
  firm.lastChecked = today;
  firm.stale = false;
  return changes;
}

// --url=<adresse> : provoquer la sortie « ÉCHEC » à la main (une page qui n'est pas la leur).
const URL_ARG = process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length);

async function fetchTradeify(fetchImpl = fetch, url = URL_ARG ?? TRADEIFY_URL) {
  const res = await fetchImpl(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.text();
}

/**
 * Une relecture complète, sans fichier : `data` = contenu de compare-extra-firms.json (modifié
 * en place). ok:false = page illisible, la firme est seulement marquée stale.
 */
export async function runTradeify(data, { read = fetchTradeify, now = Date.now(), log = console.log } = {}) {
  const firm = data.firms.find((f) => f.id === FIRM_ID);
  if (!firm) throw new Error(`${FIRM_ID} absent de compare-extra-firms.json`);
  const today = new Date(now).toISOString().slice(0, 10);
  let parsed;
  try {
    parsed = parseTradeify(await read(), now);
    // Les 12 comptes du JSON doivent tous avoir été relus.
    for (const program of firm.programs)
      for (const plan of program.plans)
        if (!parsed.plans.some((p) => p.programName === program.name && p.size === plan.size))
          throw new Error(`${program.name} $${plan.size / 1000}K du JSON pas trouvé sur leur page`);
  } catch (e) {
    firm.stale = true;
    log(`${FIRM_ID}: ÉCHEC — pas pu lire la page : ${e.message} — données gardées, stale: true`);
    return { ok: false, changes: [] };
  }
  for (const n of parsed.notices) log(`${FIRM_ID}: NOTICE — ${n}`);
  const changes = applyTradeify(firm, parsed, today);
  const perProgram = Object.entries(parsed.offers).map(([name, o]) => `${name} ${o.code}`).join(', ');
  const offer = perProgram
    ? `codes par programme : ${perProgram}`
    : parsed.promo
      ? `code ${parsed.promo.code}${parsed.promo.ends ? ` jusqu'au ${parsed.promo.ends}` : ''}`
      : 'aucun code affiché';
  if (changes.length === 0) log(`${FIRM_ID}: OK — ${parsed.plans.length} prix relus, rien n'a changé (${offer})`);
  else {
    log(`${FIRM_ID}: OK — ${parsed.plans.length} prix relus (${offer}), ${changes.length} changement(s) :`);
    for (const c of changes) log(`  ${c}`);
  }
  return { ok: true, changes };
}

async function main() {
  const dry = process.argv.includes('--dry');
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));
  const { ok } = await runTradeify(data, { log: (l) => (l.includes('ÉCHEC') ? console.error(l) : console.log(l)) });
  if (dry) console.log('--dry : rien écrit.');
  else fs.writeFileSync(DATA_URL, JSON.stringify(data, null, 2) + '\n');
  if (!ok) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('scrape-tradeify.mjs')) main();
