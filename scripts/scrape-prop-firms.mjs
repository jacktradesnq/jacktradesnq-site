#!/usr/bin/env node
/**
 * Daily sync for public/data/prop-firms.json.
 *
 * Deux chemins, selon ce que rend le scraper d'une firme :
 *
 *  - `{ programs }` — un LECTEUR de catalogue (scripts/lib/firms/*.mjs) a lu
 *    tout ce que la firme vend. guardCatalog() + syncCatalog() creent les
 *    programmes et les tailles nouveaux, retirent ce qui n'est plus vendu, et
 *    gardent les regles curatees a la main que le lecteur n'encode pas.
 *    Traders Launch, Blue Guardian.
 *
 *  - `{ updates }` — le chemin historique, un metteur a jour de PRIX sur des
 *    programmes figes a la main : guard() + apply() ne touchent que price /
 *    originalPrice / activationFee. E8 reste dessus, faute de lecteur.
 *
 * Dans les deux cas les promos (promo firme, promoCode / promoLabel par
 * programme) passent par applyPromos(), et une firme dont le scraper echoue
 * garde ses donnees avec stale: true — les autres firmes continuent.
 * Exit code is 0 unless the JSON write fails.
 *
 * Usage: node scripts/scrape-prop-firms.mjs [--dry]
 */

import fs from 'node:fs';

import { guardCatalog, syncCatalog } from './lib/catalog-sync.mjs';
import { BLUE_GUARDIAN_URL, programsFromHtml as blueGuardianPrograms } from './lib/firms/blueguardian.mjs';
import { fetchTradersLaunchPrograms } from './lib/firms/traderslaunch.mjs';

const DATA_URL = new URL('../public/data/prop-firms.json', import.meta.url);
const DRY = process.argv.includes('--dry');
const TODAY = new Date().toISOString().slice(0, 10);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const num = (s) => parseFloat(String(s).replace(/[,\s]/g, ''));
const pctOff = (price, original) => Math.round((1 - price / original) * 100);

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Most frequent value of an array (ties broken by first seen).
function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
  return { value: best, count: bestN };
}

/* ------------------------------------------------------------------ */
/* Blue Guardian — RSC payload embedded in https://www.blueguardian.com/futures */
/* ------------------------------------------------------------------ */

const HTML_ENTITIES = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#x27;': "'", '&#39;': "'" };

function decodePayloadHtml(html) {
  let s = html;
  let prev;
  do {
    prev = s;
    s = s.replace(/&(amp|quot|lt|gt|#x27|#39);/g, (m) => HTML_ENTITIES[m]);
  } while (s !== prev);
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.split('\\"').join('"');
  return s;
}

// Balanced-bracket extraction (string-aware), from the '[' at `start`.
function extractBalancedArray(s, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// Le CATALOGUE de Blue Guardian vient de scripts/lib/firms/blueguardian.mjs,
// qui lit le meme payload RSC : produits, tailles, regles. Ce qui reste ici est
// ce que le lecteur ne dit pas, parce que ce n'est pas du catalogue — le code
// coupon porte par chaque taille, et le pourcentage qu'il retire.
function blueGuardianPromo(html) {
  const s = decodePayloadHtml(html);
  const idx = s.indexOf('"plans":[');
  if (idx === -1) throw new Error('"plans":[ payload not found');
  const arrText = extractBalancedArray(s, s.indexOf('[', idx));
  if (!arrText) throw new Error('unbalanced plans array');

  const couponCodes = [];
  const pcts = [];
  for (const entry of JSON.parse(arrText)) {
    if (!entry || entry.market !== 'futures') continue;
    for (const size of entry.sizes ?? []) {
      if (size.coupon?.code) couponCodes.push(size.coupon.code);
      if (size.currentPrice != null && size.originalPrice != null)
        pcts.push(pctOff(size.currentPrice, size.originalPrice));
    }
  }

  if (couponCodes.length === 0) return null; // no coupon anywhere => promo really is off
  const code = mode(couponCodes).value;
  const pct = pcts.length > 0 ? mode(pcts).value : null;
  return pct != null ? { label: `${pct}% OFF`, code } : undefined; // undefined => keep existing label
}

async function scrapeBlueGuardian() {
  const html = await fetchText(BLUE_GUARDIAN_URL);
  const programs = blueGuardianPrograms(html);

  // Le catalogue vaut plus que la banniere : un coupon devenu illisible garde
  // la promo deja publiee au lieu de faire perdre la firme entiere.
  let firmPromo;
  try {
    firmPromo = blueGuardianPromo(html);
  } catch (e) {
    console.log(`  blue-guardian: coupons illisibles (${e.message}) — promo existante gardee`);
  }
  return { programs, firmPromo };
}

/* ------------------------------------------------------------------ */
/* Traders Launch — server-rendered cards on https://traderslaunch.com  */
/* ------------------------------------------------------------------ */

// Le comparateur n'etiquette que trois drawdowns ("No trail", "EOD Trail",
// "Intraday Trail"). Leurs cartes ecrivent "EOD - Locks at Starting Balance" :
// un drawdown de fin de journee qui suit les plus hauts jusqu'a revenir au
// solde de depart, ou il se fige — "EOD Trailing" dans notre vocabulaire, et
// la legende du tableau dit ce que l'etiquette veut dire. Une formulation
// inconnue arrete la firme plutot que de publier un drawdown que la page ne
// sait pas nommer.
const TRADERSLAUNCH_DD = {
  'EOD - Locks at Starting Balance': 'EOD Trailing',
  'EOD': 'EOD',
  'EOD Trailing': 'EOD Trailing',
  'Intraday': 'Intraday',
};

async function scrapeTradersLaunch() {
  const programs = await fetchTradersLaunchPrograms();
  for (const program of programs) {
    for (const plan of program.plans) {
      if (plan.ddType == null) continue;
      const vocab = TRADERSLAUNCH_DD[plan.ddType];
      if (!vocab) throw new Error(`drawdown « ${plan.ddType} » hors du vocabulaire du comparateur`);
      plan.ddType = vocab;
    }
  }
  return { programs }; // no promo recipe for this firm — promo stays manual
}

/* ------------------------------------------------------------------ */
/* E8 Markets — client-rendered pricing on https://e8futures.com, needs playwright (optional) */
/* ------------------------------------------------------------------ */

const E8_TABS = {
  'E8 Signature': 'E8 Signature Futures',
  'E8 Zero MAX': 'E8 Zero MAX Futures',
  'E8 Zero Starter': 'E8 Zero Starter Futures',
};

async function scrapeE8Markets() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    console.log('e8-markets: playwright not installed, skipped');
    return null;
  }
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('https://e8futures.com', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);

    const configBtn = page.getByText('Configure Challenge', { exact: true }).first();
    await configBtn.scrollIntoViewIfNeeded();
    await configBtn.click();
    await page.waitForTimeout(2000);

    const updates = [];
    for (const [tabText, programName] of Object.entries(E8_TABS)) {
      await page.locator('button', { hasText: tabText }).first().click({ timeout: 15000 });
      await page.waitForTimeout(1200);

      const cardsText = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('p, span, div, h1, h2, h3, h4'));
        const labels = all.filter(
          (el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === 'account size',
        );
        const cards = [];
        for (const label of labels) {
          let node = label;
          let container = null;
          for (let i = 0; i < 10 && node.parentElement; i++) {
            node = node.parentElement;
            const t = node.textContent.toLowerCase();
            if (t.includes('challenge rules') && t.includes('get started')) {
              container = node;
              break;
            }
          }
          if (container) cards.push(container.innerText);
        }
        return cards;
      });

      for (const cardText of cardsText) {
        const sizeM = /\$(\d+)K/i.exec(cardText);
        const priceM = /PRICE\s*\n*\$([\d.]+)\s*\n*\$([\d.,]+)/.exec(cardText);
        if (!sizeM || !priceM) continue;
        updates.push({
          programName,
          size: parseInt(sizeM[1], 10) * 1000,
          price: num(priceM[1]),
          originalPrice: num(priceM[2]),
        });
      }
    }
    if (updates.length === 0) throw new Error('no plan cards parsed from Configure Challenge widget');
    return { updates }; // promo stays manual — site banner label is vaguer than the curated JSON copy
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ */
/* Guards + apply                                                      */
/* ------------------------------------------------------------------ */

function guard(firm, res) {
  const plansTotal = firm.programs.reduce((n, p) => n + p.plans.length, 0);
  let matched = 0;
  for (const program of firm.programs) {
    for (const plan of program.plans) {
      const u = res.updates.find((x) => x.programName === program.name && x.size === plan.size);
      if (!u) continue;
      if (!Number.isFinite(u.price)) throw new Error(`${program.name} $${plan.size / 1000}K: non-numeric price`);
      if (u.price < 10 || u.price > 6000)
        throw new Error(`${program.name} $${plan.size / 1000}K: price ${u.price} out of range [10, 6000]`);
      if (u.originalPrice != null && u.price > u.originalPrice)
        throw new Error(
          `${program.name} $${plan.size / 1000}K: price ${u.price} > originalPrice ${u.originalPrice}`,
        );
      matched++;
    }
  }
  if (matched !== plansTotal)
    throw new Error(`scraped ${matched}/${plansTotal} expected plans — refusing partial update`);
}

function apply(firm, res, changes) {
  for (const program of firm.programs) {
    for (const plan of program.plans) {
      const u = res.updates.find((x) => x.programName === program.name && x.size === plan.size);
      const tag = `${firm.name} / ${program.name} $${plan.size / 1000}K`;
      // Only firms whose scraper reports the field carry the key: for everyone
      // else it stays hand-maintained, untouched.
      if ('activationFee' in u) {
        const before = plan.activationFee ?? null;
        if (before !== u.activationFee) {
          changes.push(`${tag}: activationFee ${before} -> ${u.activationFee}`);
          if (u.activationFee == null) delete plan.activationFee;
          else plan.activationFee = u.activationFee;
        }
      }
      if (plan.price !== u.price) {
        changes.push(`${tag}: price ${plan.price} -> ${u.price}`);
        plan.price = u.price;
      }
      if (plan.originalPrice !== u.originalPrice) {
        changes.push(`${tag}: originalPrice ${plan.originalPrice} -> ${u.originalPrice}`);
        plan.originalPrice = u.originalPrice;
      }
    }
  }
  applyPromos(firm, res, changes);
}

// Les promos, communes aux deux chemins : un `firmPromo` absent (undefined)
// garde celle qui est publiee, un `null` explicite dit que la promo est finie.
function applyPromos(firm, res, changes) {
  for (const program of firm.programs) {
    const promo = res.programPromos?.[program.name];
    if (!promo) continue;
    if (program.promoCode !== promo.code) {
      changes.push(`${firm.name} / ${program.name}: promoCode ${program.promoCode} -> ${promo.code}`);
      program.promoCode = promo.code;
    }
    if (promo.label != null && program.promoLabel !== promo.label) {
      changes.push(`${firm.name} / ${program.name}: promoLabel ${program.promoLabel} -> ${promo.label}`);
      program.promoLabel = promo.label;
    }
  }
  if (res.firmPromo !== undefined) {
    const oldStr = JSON.stringify(firm.promo);
    const newStr = JSON.stringify(res.firmPromo);
    if (oldStr !== newStr) {
      changes.push(`${firm.name}: promo ${oldStr} -> ${newStr}`);
      firm.promo = res.firmPromo;
    }
  }
  firm.lastChecked = TODAY;
  firm.stale = false;
}

const SCRAPERS = {
  'blue-guardian': scrapeBlueGuardian,
  'traders-launch': scrapeTradersLaunch,
  'e8-markets': scrapeE8Markets,
};

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));
  let totalChanges = 0;

  for (const firm of data.firms) {
    const scraper = SCRAPERS[firm.id];
    if (!scraper) {
      console.log(`${firm.id}: no scraper defined, skipped`);
      continue;
    }
    try {
      const res = await scraper();
      if (res === null) continue; // skipped (playwright missing)
      const changes = [];
      if (res.programs) {
        // Un lecteur a rendu tout ce que la firme vend : le catalogue suit.
        guardCatalog(firm, res.programs);
        syncCatalog(firm, res.programs, changes);
        applyPromos(firm, res, changes);
      } else {
        // Chemin historique : des prix sur des programmes figes a la main.
        guard(firm, res);
        apply(firm, res, changes);
      }
      totalChanges += changes.length;
      const plansTotal = firm.programs.reduce((n, p) => n + p.plans.length, 0);
      if (changes.length === 0) {
        console.log(`${firm.id}: OK — ${plansTotal} plans verified, no changes`);
      } else {
        console.log(`${firm.id}: OK — ${plansTotal} plans verified, ${changes.length} change(s):`);
        for (const c of changes) console.log(`  ${c}`);
      }
    } catch (e) {
      firm.stale = true;
      console.error(`${firm.id}: FAILED — ${e.message} — keeping existing data, stale: true`);
    }
  }

  if (DRY) {
    console.log(`--dry: no write. ${totalChanges} pending change(s).`);
    return;
  }
  data.generatedAt = TODAY;
  try {
    fs.writeFileSync(DATA_URL, JSON.stringify(data, null, 2) + '\n');
    console.log(`wrote ${DATA_URL.pathname} (${totalChanges} change(s), generatedAt ${TODAY})`);
  } catch (e) {
    console.error(`FATAL: could not write JSON: ${e.message}`);
    process.exit(1);
  }
}

// Importable for tests without running the sync.
if (process.argv[1] && process.argv[1].endsWith('scrape-prop-firms.mjs')) main();
