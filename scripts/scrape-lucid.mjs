#!/usr/bin/env node
/**
 * Lucid Trading (comparateur, compare-extra-firms.json) : prix relus chaque jour sur
 * https://lucidtrading.com/#plans. Un simple fetch reçoit un 403 Cloudflare (« Just a moment... »,
 * constaté le 22/11/2026) : la page se lit dans un navigateur headless (playwright), comme E8.
 * Avant ce script Lucid n'était jamais relu (prix figés au 01/11 : Pro et Flex 25K / 50K avaient
 * monté, rien ne l'a dit, Angelo 22/11/2026 : « pk lucid ça a pas fait automatiquement »).
 *
 * Met à jour : price / originalPrice de chaque plan (prix avec le code, base barrée), les chiffres
 * de leurs notes (« Daily Loss Limit OFF: $95.90 », « 50% consistency add-on: $58.10 »,
 * « Reset fee $81 ») et lastChecked. Le reste des notes, écrit à la main, ne bouge pas.
 * Page illisible (403, challenge Cloudflare, plan du JSON absent, remise qui n'est plus celle du
 * JSON) = firme stale, données gardées, échec : le workflow le dit sur Discord (étape « stale firms »).
 *
 *   node scripts/scrape-lucid.mjs                  relit et écrit compare-extra-firms.json
 *   node scripts/scrape-lucid.mjs --dry            relit, n'écrit rien
 *   node scripts/scrape-lucid.mjs --dump=lecture.json   écrit aussi la lecture brute de la page
 * LUCID_CHROMIUM=<chemin> choisit un autre Chromium que celui de playwright.
 *
 * Lecture (23/11/2026) : la page est d'abord lue par curl_cffi (impersonate chrome, scripts/lib/cf-get.py ;
 * `pip install curl_cffi`), qui passe là où fetch reçoit 403 Cloudflare. Tout le tarif est dans le JSON
 * `var LucidPricingConfig` du HTML : readingFromConfig en tire la même lecture que le DOM (mêmes champs, mesuré
 * identique à la lecture Playwright du 23/11). curl_cffi en échec (statut, JSON absent ou de schéma inconnu) :
 * repli sur le navigateur headless ci-dessus, et le log dit laquelle des deux méthodes a lu.
 */
import fs from 'node:fs';
import { cfFetch } from './lib/cf-fetch.mjs';

const FIRM_ID = 'lucid-trading';
const DATA_URL = new URL('../public/data/compare-extra-firms.json', import.meta.url);
const LUCID_URL = 'https://lucidtrading.com/#plans';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const LUCID_SIZES = [25000, 50000, 100000, 150000];

/** Programme du JSON -> onglet de leur page, et version (Daily : drawdown d'évaluation EOD ou Intraday). */
export const LUCID_PROGRAMS = {
  LucidPro: { tab: 'Pro' },
  LucidFlex: { tab: 'Flex' },
  'LucidDaily (EOD eval drawdown)': { tab: 'Daily', variant: 'eod' },
  'LucidDaily (Intraday eval drawdown)': { tab: 'Daily', variant: 'intraday' },
  LucidDirect: { tab: 'Direct' },
};

/**
 * Lu dans la page (exécuté par le navigateur) : par onglet puis par taille, le prix avec le code
 * (price), la base barrée (original), le reset fee, et selon l'onglet le prix sans daily loss
 * (dllOff), avec 50 % de consistency (c50), en drawdown Intraday (intraday). Tout se lit dans le
 * texte du DOM (textContent) : leurs cartes ne sont pas « visibles » pour un navigateur sans écran.
 */
async function readInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const money = (s) => Number(String(s).replace(/,/g, ''));
  const tabBtn = (name) => [...document.querySelectorAll('button,[role=tab]')].find((x) => norm(x.textContent) === name);
  const hasPrice = (t) => /one time (?:fee|payment)/i.test(t);
  const cardOf = (size, key) =>
    [...document.querySelectorAll('article,div')]
      .filter((x) => {
        const t = norm(x.textContent);
        return new RegExp('^' + size + 'K ' + key + '\\b').test(t) && hasPrice(t) && t.length < 1400;
      })
      .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length)[0];
  const priceOf = (c) => {
    const t = norm(c.textContent);
    const m = t.match(/one time (?:fee|payment)\s*\$(\d[\d,]*(?:\.\d+)?)\s*\$(\d[\d,]*(?:\.\d+)?)/i) || t.match(/\$(\d[\d,]*(?:\.\d+)?)\s*\$(\d[\d,]*(?:\.\d+)?)\s*\/?\s*one time payment/i);
    const r = t.match(/reset fee\s*\$(\d[\d,]*(?:\.\d+)?)/i);
    return m ? { original: money(m[1]), price: money(m[2]), reset: r ? money(r[1]) : null } : null;
  };
  const btns = (c) => [...c.querySelectorAll('button')];
  const label = (b) => norm(b.textContent);
  const out = { codeSeen: /\bVAULT\b/.test(document.body.textContent), tabs: {} };
  for (const [tab, key] of [['Pro', 'PRO'], ['Flex', 'FLEX'], ['Daily', 'DAILY'], ['Direct', 'DIRECT']]) {
    const tb = tabBtn(tab);
    if (!tb) { out.tabs[tab] = null; continue; }
    tb.click();
    await sleep(500);
    out.tabs[tab] = {};
    for (const size of [25, 50, 100, 150]) {
      let c = cardOf(size, key);
      if (!c) continue;
      const base = priceOf(c);
      if (!base) continue;
      const entry = { ...base };
      // Sans daily loss : le premier bouton « OFF » de la carte (le 1er groupe est le daily loss).
      const off = btns(c).filter((b) => label(b) === 'OFF')[0];
      const dllOn = btns(c).find((b) => /^\$\d/.test(label(b)));
      if (off && dllOn && tab !== 'Direct') {
        off.click(); await sleep(300);
        entry.dllOff = priceOf(c)?.price ?? null;
        dllOn.click(); await sleep(250);
      }
      const b50 = btns(c).find((b) => /^50%/.test(label(b)));
      const b40 = btns(c).find((b) => /^40%/.test(label(b)));
      if (b50 && b40) {
        b50.click(); await sleep(300);
        entry.c50 = priceOf(c)?.price ?? null;
        b40.click(); await sleep(250);
      }
      if (tab === 'Daily') {
        const intr = btns(c).find((b) => label(b) === 'Intraday');
        const eod = btns(c).find((b) => label(b) === 'EOD');
        if (intr && eod) {
          intr.click(); await sleep(300);
          const p = priceOf(c);
          entry.intraday = p ? { original: p.original, price: p.price, reset: p.reset } : null;
          eod.click(); await sleep(250);
        }
      }
      // Les toggles remis comme au départ : la carte doit redonner le prix du début.
      const back = priceOf(c);
      if (!back || back.price !== base.price) entry.unstable = true;
      out.tabs[tab][size * 1000] = entry;
    }
  }
  return out;
}

/** Ouvre leur page dans un Chromium headless et renvoie la lecture brute. */
export async function readLucidPage({ chromiumPath = process.env.LUCID_CHROMIUM } = {}) {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    throw new Error('playwright absent (npm ci puis npx playwright install chromium)');
  }
  const browser = await pw.chromium.launch({ headless: true, ...(chromiumPath ? { executablePath: chromiumPath } : {}) });
  try {
    const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const res = await page.goto(LUCID_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    try {
      await page.waitForFunction(() => /25K\s+PRO\s+EVAL/.test(document.body.textContent), null, { timeout: 30_000 });
    } catch {
      const title = await page.title().catch(() => '');
      throw new Error(`page des plans pas servie (HTTP ${res?.status() ?? '?'}, titre « ${title} »)${/just a moment/i.test(title) ? ' : challenge Cloudflare' : ''}`);
    }
    return await page.evaluate(readInPage);
  } finally {
    await browser.close();
  }
}

/** Objet JSON qui commence à `start` (premier « { »), en respectant les chaînes et leurs échappements. */
function jsonObjectAt(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('LucidPricingConfig : JSON non terminé');
}

/** Le JSON de tarifs que leur page embarque (`var LucidPricingConfig = {...}`), lu dans le HTML brut. */
export function lucidConfigFromHtml(html) {
  const at = html.indexOf('var LucidPricingConfig = ');
  if (at < 0) {
    const title = html.match(/<title>([^<]*)/i)?.[1]?.trim() ?? '';
    throw new Error(`LucidPricingConfig absent de la page (titre « ${title} »)${/just a moment/i.test(title) ? ' : challenge Cloudflare' : ''}`);
  }
  const cfg = JSON.parse(jsonObjectAt(html, html.indexOf('{', at)));
  if (cfg?.plans?.schemaVersion !== 1) throw new Error(`LucidPricingConfig : schemaVersion ${cfg?.plans?.schemaVersion} inconnue (1 attendue)`);
  return cfg;
}

const cents = (x) => Number(x.toFixed(2));

/**
 * La lecture que readInPage tirait du DOM (mêmes champs : par onglet puis par taille, original / price / reset,
 * dllOff, c50, intraday), calculée depuis le JSON de leur page :
 *  - base = productPrices du produit de la taille ; price = base moins la remise de la taille (code VAULT) ;
 *  - reset = productPrices du produit reset (remise reset du JSON, 0 aujourd'hui) ;
 *  - dllOff = (base + addonFees) moins la remise « nodll » de la taille ; c50 = (base + consistencyAddon.fees) moins la remise.
 * Un produit absent du JSON laisse le champ absent : applyLucid le dit (« pas trouvé sur leur page »).
 */
export function readingFromConfig(cfg, html = '') {
  const prices = cfg.productPrices ?? {};
  const price = (id) => (id != null && prices[id] != null ? Number(prices[id]) : null);
  const front = (pt, id) => pt.front.find((f) => f.id === id)?.cells ?? {};
  const resetPct = Number(cfg.plans.global?.resetDiscountPct ?? 0);
  const consistency = cfg.consistencyAddon ?? {};
  const visible = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const out = { codeSeen: /\bVAULT\b/.test(visible), tabs: {} };
  const byId = Object.fromEntries(cfg.plans.planTypes.map((pt) => [pt.id, pt]));
  for (const [tab, key] of [['Pro', 'pro'], ['Flex', 'flex'], ['Daily', 'daily'], ['Direct', 'direct']]) {
    const pt = byId[key];
    if (!pt || pt.enabled === false) { out.tabs[tab] = null; continue; }
    const fee = front(pt, 'one_time_fee');
    const reset = front(pt, 'reset_fee');
    const tabOut = {};
    for (const size of pt.sizes) {
      const sizePct = Number(size.discountPct ?? 0);
      const noDllPct = Number(cfg.noDllDiscounts?.[`${String(size.discountSlug).toLowerCase()}nodll`] ?? sizePct);
      const after = (base, pct) => (base == null ? null : cents((base * (100 - pct)) / 100));
      const feeIds = fee[size.id];
      const resetIds = reset[size.id];
      const eodId = typeof feeIds === 'object' ? feeIds?.EOD : feeIds;
      const eodResetId = typeof resetIds === 'object' ? resetIds?.EOD : resetIds;
      const original = price(eodId);
      if (original == null) continue;
      const entry = {
        original,
        price: after(original, sizePct),
        reset: price(eodResetId) == null ? null : after(price(eodResetId), resetPct),
      };
      const dllFee = cfg.addonFees?.[eodId];
      if (key !== 'direct' && dllFee != null) entry.dllOff = after(original + dllFee, noDllPct);
      const c50Fee = consistency.fees?.[eodId];
      if ((consistency.planTypes ?? []).includes(pt.slug) && c50Fee != null) entry.c50 = after(original + c50Fee, sizePct);
      if (key === 'daily' && typeof feeIds === 'object') {
        const base = price(feeIds.Intraday);
        const rs = price(resetIds?.Intraday);
        entry.intraday = base == null ? null : { original: base, price: after(base, sizePct), reset: rs == null ? null : after(rs, resetPct) };
      }
      tabOut[parseInt(size.title, 10) * 1000] = entry;
    }
    out.tabs[tab] = tabOut;
  }
  return out;
}

/** Lit lucidtrading.com par curl_cffi et renvoie la même lecture que readLucidPage (sans navigateur). */
export async function readLucidViaCurlCffi({ fetchPage = cfFetch, log = () => {} } = {}) {
  const { status, text, via } = await fetchPage(LUCID_URL.replace(/#.*$/, ''));
  if (status !== 200) throw new Error(`page des plans pas servie par curl_cffi (HTTP ${status}${via ? `, profil ${via}` : ''})`);
  log(`lucid-trading: page lue par curl_cffi, profil ${via ?? '?'}`);
  return readingFromConfig(lucidConfigFromHtml(text), text);
}

/**
 * curl_cffi d'abord, `attempts` essais espacés de `pauseMs` (Cloudflare bloque par intermittence : sur un runner GitHub le
 * 23/11/2026, 2 lectures sur 3 passaient) ; tous en échec, le navigateur headless. `log` dit quelle méthode a lu.
 */
export async function readLucid({ viaCurl = readLucidViaCurlCffi, viaBrowser = readLucidPage, log = console.log, attempts = 3, pauseMs = 20_000 } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const reading = await viaCurl({ log });
      log('lucid-trading: lu par curl_cffi');
      return reading;
    } catch (e) {
      last = e;
      log(`lucid-trading: curl_cffi essai ${i}/${attempts} échoué (${e.message})`);
      if (i < attempts && pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  log(`lucid-trading: curl_cffi a échoué ${attempts} fois (${last.message}), repli sur le navigateur headless`);
  const reading = await viaBrowser();
  log('lucid-trading: lu par le navigateur headless');
  return reading;
}

const money2 = (n) => (Number.isInteger(n) ? `${n}.00` : n.toFixed(2));
const sameNum = (a, b) => Math.abs(a - b) < 0.005;

/** Rabais du libellé de promo du JSON (« 30% off with code VAULT » -> 30), 0 sans promo. */
const promoPct = (firm) => Number(firm.promo?.label?.match(/^(\d+)% off/)?.[1] ?? 0);

/**
 * Applique une lecture à la firme (copie modifiée en place). Renvoie la liste des changements.
 * Lève une erreur si un plan du JSON manque dans la lecture, si une carte n'est pas revenue à son
 * prix de départ, ou si le prix lu ne vaut plus la base moins le rabais de la promo du JSON.
 */
export function applyLucid(firm, reading, today) {
  const pct = promoPct(firm);
  const changes = [];
  const notices = [];
  if (firm.promo?.code && reading.codeSeen === false) notices.push(`le code ${firm.promo.code} n'apparaît plus sur leur page`);
  for (const program of firm.programs) {
    const spec = LUCID_PROGRAMS[program.name];
    if (!spec) throw new Error(`programme « ${program.name} » inconnu du script : à relire à la main`);
    for (const plan of program.plans) {
      const tag = `${program.name} $${plan.size / 1000}K`;
      const r = reading.tabs?.[spec.tab]?.[plan.size];
      if (!r) throw new Error(`${tag} du JSON pas trouvé sur leur page`);
      if (r.unstable) throw new Error(`${tag} : la carte n'est pas revenue à son prix après les boutons`);
      const shown = spec.variant === 'intraday' ? r.intraday : r;
      if (!shown || !Number.isFinite(shown.price) || !Number.isFinite(shown.original)) throw new Error(`${tag} : prix illisible`);
      if (shown.price < 10 || shown.original > 3000) throw new Error(`${tag} : prix ${shown.price}/${shown.original} hors de [10, 3000]`);
      const expected = (shown.original * (100 - pct)) / 100;
      if (pct > 0 && Math.abs(shown.price - expected) > 0.011)
        throw new Error(`${tag} : ${shown.price} n'est pas ${shown.original} moins ${pct} % (${expected.toFixed(2)}) : la promo a changé, à relire à la main`);
      if (plan.price !== shown.price) {
        changes.push(`${tag} : price ${plan.price} -> ${shown.price}`);
        plan.price = shown.price;
      }
      if (plan.originalPrice !== shown.original) {
        changes.push(`${tag} : originalPrice ${plan.originalPrice} -> ${shown.original}`);
        plan.originalPrice = shown.original;
      }
      // Chiffres de la note : seulement ceux que la note écrit déjà, et seulement sur la version de base.
      let note = plan.note ?? '';
      const fixes = [
        [/Daily Loss Limit OFF: \$\d[\d,]*(?:\.\d+)?/, r.dllOff, (v) => `Daily Loss Limit OFF: $${money2(v)}`, 'sans daily loss'],
        [/50% consistency add-on: \$\d[\d,]*(?:\.\d+)?/, r.c50, (v) => `50% consistency add-on: $${money2(v)}`, '50 % de consistency'],
        [/Reset fee \$\d[\d,]*(?:\.\d+)?/, shown.reset, (v) => `Reset fee $${v}`, 'reset fee'],
      ];
      for (const [re, value, write, what] of fixes) {
        if (!re.test(note)) continue;
        if (!Number.isFinite(value)) throw new Error(`${tag} : la note parle de « ${what} », leur page ne l'a pas donné`);
        const next = note.replace(re, write(value));
        if (next !== note) changes.push(`${tag} : note (${what}) -> ${write(value)}`);
        note = next;
      }
      if (note !== (plan.note ?? '')) plan.note = note;
    }
  }
  firm.lastChecked = today;
  firm.stale = false;
  return { changes, notices };
}

/**
 * Une relecture complète, sans fichier : `data` = contenu de compare-extra-firms.json (modifié en
 * place). ok:false = page illisible, la firme est seulement marquée stale.
 */
export async function runLucid(data, { read = readLucid, now = Date.now(), log = console.log } = {}) {
  const firm = data.firms.find((f) => f.id === FIRM_ID);
  if (!firm) throw new Error(`${FIRM_ID} absent de compare-extra-firms.json`);
  const today = new Date(now).toISOString().slice(0, 10);
  const before = structuredClone(firm);
  let result;
  try {
    result = applyLucid(firm, await read(), today);
  } catch (e) {
    Object.assign(firm, before, { stale: true });
    log(`${FIRM_ID}: ÉCHEC — pas pu lire la page : ${e.message} — données gardées, stale: true`);
    return { ok: false, changes: [] };
  }
  for (const n of result.notices) log(`${FIRM_ID}: NOTICE — ${n}`);
  const count = firm.programs.reduce((n, p) => n + p.plans.length, 0);
  if (result.changes.length === 0) log(`${FIRM_ID}: OK — ${count} prix relus, rien n'a changé`);
  else {
    log(`${FIRM_ID}: OK — ${count} prix relus, ${result.changes.length} changement(s) :`);
    for (const c of result.changes) log(`  ${c}`);
  }
  return { ok: true, changes: result.changes };
}

async function main() {
  const dry = process.argv.includes('--dry');
  const dump = process.argv.find((a) => a.startsWith('--dump='))?.slice('--dump='.length);
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));
  const { ok } = await runLucid(data, {
    read: async () => {
      const reading = await readLucid();
      if (dump) fs.writeFileSync(dump, JSON.stringify(reading, null, 2) + '\n');
      return reading;
    },
    log: (l) => (l.includes('ÉCHEC') ? console.error(l) : console.log(l)),
  });
  if (dry) console.log('--dry : rien écrit.');
  else fs.writeFileSync(DATA_URL, JSON.stringify(data, null, 2) + '\n');
  if (!ok) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('scrape-lucid.mjs')) main();
