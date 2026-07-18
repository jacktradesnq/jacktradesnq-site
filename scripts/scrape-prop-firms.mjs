#!/usr/bin/env node
/**
 * Daily price sync for public/data/prop-firms.json.
 *
 * Updates ONLY: plan price / originalPrice, program promoCode / promoLabel,
 * firm promo, firm lastChecked / stale, top-level generatedAt.
 * Risk rules (profit target, drawdown, daily loss, consistency, contracts)
 * are maintained manually and never touched here.
 *
 * Per-firm guards: numeric price, 10 <= price <= 6000, price <= originalPrice,
 * scraped plan count must cover every plan already in the JSON for that firm.
 * Any guard failure => keep the firm's existing data, mark stale: true, log,
 * continue with the other firms. Exit code is 0 unless the JSON write fails.
 *
 * Usage: node scripts/scrape-prop-firms.mjs [--dry]
 */

import fs from 'node:fs';

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

const BG_PROGRAMS = { direct: 'Direct', express: 'Express', reserve: 'Reserve', standard: 'Standard' };

async function scrapeBlueGuardian() {
  const html = await fetchText('https://www.blueguardian.com/futures');
  const s = decodePayloadHtml(html);
  const idx = s.indexOf('"plans":[');
  if (idx === -1) throw new Error('"plans":[ payload not found');
  const arrText = extractBalancedArray(s, s.indexOf('[', idx));
  if (!arrText) throw new Error('unbalanced plans array');
  const payload = JSON.parse(arrText);
  const futures = payload.filter((p) => p && p.market === 'futures');
  if (futures.length === 0) throw new Error('no futures entries in payload');

  const updates = [];
  const couponCodes = [];
  const pcts = [];
  for (const entry of futures) {
    const programName = BG_PROGRAMS[entry.key];
    if (!programName) continue;
    for (const size of entry.sizes ?? []) {
      const price = size.currentPrice ?? size.originalPrice;
      const originalPrice = size.currentPrice != null ? (size.originalPrice ?? null) : null;
      updates.push({ programName, size: size.amount, price, originalPrice });
      if (size.coupon?.code) couponCodes.push(size.coupon.code);
      if (originalPrice != null) pcts.push(pctOff(price, originalPrice));
    }
  }

  let firmPromo = null; // no coupon anywhere => promo really is off
  if (couponCodes.length > 0) {
    const code = mode(couponCodes).value;
    const pct = pcts.length > 0 ? mode(pcts).value : null;
    firmPromo = pct != null ? { label: `${pct}% OFF`, code } : undefined; // undefined => keep existing label/promo
  }
  return { updates, firmPromo };
}

/* ------------------------------------------------------------------ */
/* Top One Futures — Webflow server-rendered tabs on https://toponefutures.com */
/* ------------------------------------------------------------------ */

const TOPONE_TABS = {
  '1-Step ELITE Challange': 'Elite Challenge', // typo is on their site
  'Elite Daily': 'Elite Daily',
  'Elite Access': 'Elite Access',
  'INSTANT Sim Funded': 'Instant Sim Funded',
  'S2F Sim Funded': 'S2F Sim Pro',
  'Ignite AF': 'Ignite',
};
const TOPONE_SIZES = [25000, 50000, 100000, 150000];

async function scrapeTopOne() {
  const html = await fetchText('https://toponefutures.com');
  const updates = [];
  const programPromos = {};
  const codeCounts = [];
  const programPcts = [];

  for (const [tab, programName] of Object.entries(TOPONE_TABS)) {
    const marker = `data-w-tab="${tab}"`;
    const last = html.lastIndexOf(marker);
    if (last === -1) throw new Error(`tab pane not found: ${tab}`);
    const next = html.indexOf('data-w-tab="', last + marker.length);
    const block = html.slice(last, next === -1 ? undefined : next);

    const re = /price__text[^>]*">\$([\d,]+)(\/mo)?<\/div><div class="price__prev">\$([\d,]+)/g;
    const pairs = [];
    let m;
    while ((m = re.exec(block))) pairs.push({ price: num(m[1]), originalPrice: num(m[3]) });
    if (pairs.length !== TOPONE_SIZES.length)
      throw new Error(`${tab}: expected ${TOPONE_SIZES.length} price pairs, got ${pairs.length}`);
    pairs.forEach((p, i) => updates.push({ programName, size: TOPONE_SIZES[i], ...p }));

    // Promo code: "w. Code:" followed by the copy-code block text.
    const codeIdx = block.indexOf('w. Code:');
    const codeM =
      codeIdx === -1
        ? null
        : block.slice(codeIdx, codeIdx + 600).match(/copy-code__bot is--idle"><div>([A-Z0-9]+)<\/div>/);
    if (codeM) {
      // Program label: N% OFF only when at least 3 of 4 plans agree on the
      // rounded discount (Elite Access style bundle deals keep their manual label).
      const { value: pct, count } = mode(pairs.map((p) => pctOff(p.price, p.originalPrice)));
      const label = count >= 3 ? `${pct}% OFF` : null;
      programPromos[programName] = { code: codeM[1], label };
      codeCounts.push(codeM[1]);
      if (label) programPcts.push(pct);
    }
  }

  let firmPromo;
  if (codeCounts.length > 0 && programPcts.length > 0) {
    const code = mode(codeCounts).value;
    const min = Math.min(...programPcts);
    const max = Math.max(...programPcts);
    firmPromo = { label: min === max ? `${min}% OFF` : `${min}-${max}% OFF`, code };
  }
  return { updates, programPromos, firmPromo };
}

/* ------------------------------------------------------------------ */
/* Traders Launch — server-rendered cards on https://traderslaunch.com  */
/* ------------------------------------------------------------------ */

async function scrapeTradersLaunch() {
  const html = await fetchText('https://traderslaunch.com');
  const updates = [];
  for (const size of [100000, 200000, 300000]) {
    const label = `>$${size.toLocaleString('en-US')}<`;
    const fees = new Set();
    let idx = -1;
    while ((idx = html.indexOf(label, idx + 1)) !== -1) {
      const feeM = html.slice(idx, idx + 600).match(/\$([\d,.]+)<\/p><p[^>]*>One-time fee/);
      if (feeM) fees.add(num(feeM[1]));
    }
    if (fees.size !== 1) throw new Error(`$${size / 1000}K card: expected 1 one-time fee, got ${fees.size}`);
    updates.push({ programName: '1-Step', size, price: [...fees][0], originalPrice: null });
  }
  return { updates }; // no promo recipe for this firm — promo stays manual
}

/* ------------------------------------------------------------------ */
/* FundedSeat — client-rendered pricing, needs playwright (optional)   */
/* ------------------------------------------------------------------ */

const FUNDEDSEAT_TABS = { '1 Step': '1-Step', 'Instant Funding': 'Instant Funding' };
const MONTHS = { JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12 };

async function scrapeFundedSeat() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    console.log('fundedseat: playwright not installed, skipped');
    return null;
  }
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.goto('https://fundedseat.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#pricing-section', { timeout: 30000 });

    const updates = [];
    for (const [tabText, programName] of Object.entries(FUNDEDSEAT_TABS)) {
      await page
        .locator('#pricing-section')
        .getByText(tabText, { exact: true })
        .first()
        .click({ timeout: 15000 });
      await page.waitForTimeout(600);

      const cardTexts = await page.evaluate(() => {
        const out = new Set();
        for (const h3 of document.querySelectorAll('#pricing-section h3')) {
          if (!/Account/i.test(h3.textContent ?? '')) continue;
          let el = h3.parentElement;
          while (el && !/Add to Cart/i.test(el.innerText ?? '')) el = el.parentElement;
          if (el) out.add(el.innerText);
        }
        return [...out];
      });

      for (const text of cardTexts) {
        const sizeM = text.match(/\$([\d\s,]+)\s*Account/);
        const priceM = text.match(/Add to Cart\s*\$([\d.,]+)\s*\$([\d.,]+)/); // (original, promo)
        if (!sizeM || !priceM) continue;
        updates.push({
          programName,
          size: num(sizeM[1]),
          price: num(priceM[2]),
          originalPrice: num(priceM[1]),
        });
      }
    }

    // Top banner, e.g. "50% OFF YOUR NEXT 3 PURCHASES — USE CODE JULY50 — ENDS JULY 26"
    let firmPromo;
    const bodyText = await page.evaluate(() => document.body.innerText);
    const codeM = bodyText.match(/USE CODE\s+([A-Z0-9]+)/i);
    if (codeM) {
      const bannerPctM = bodyText.match(/(\d+)%\s*OFF/i);
      const endsM = bodyText.match(/ENDS\s+([A-Z]+)\s+(\d{1,2})/i);
      const withOriginal = updates.filter((u) => u.originalPrice != null);
      const sitePct =
        withOriginal.length > 0
          ? mode(withOriginal.map((u) => pctOff(u.price, u.originalPrice))).value
          : null;
      const label =
        sitePct != null && bannerPctM
          ? `${sitePct}% OFF + ${bannerPctM[1]}% w/ code`
          : bannerPctM
            ? `${bannerPctM[1]}% OFF w/ code`
            : `code ${codeM[1].toUpperCase()}`;
      const month = endsM ? MONTHS[endsM[1].toUpperCase()] : null;
      const ends = month
        ? `${TODAY.slice(0, 4)}-${String(month).padStart(2, '0')}-${endsM[2].padStart(2, '0')}`
        : undefined;
      firmPromo = { label, code: codeM[1].toUpperCase(), ...(ends ? { ends } : {}) };
    }
    return { updates, firmPromo };
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
      if (plan.price !== u.price) {
        changes.push(`${tag}: price ${plan.price} -> ${u.price}`);
        plan.price = u.price;
      }
      if (plan.originalPrice !== u.originalPrice) {
        changes.push(`${tag}: originalPrice ${plan.originalPrice} -> ${u.originalPrice}`);
        plan.originalPrice = u.originalPrice;
      }
    }
    const promo = res.programPromos?.[program.name];
    if (promo) {
      if (program.promoCode !== promo.code) {
        changes.push(`${firm.name} / ${program.name}: promoCode ${program.promoCode} -> ${promo.code}`);
        program.promoCode = promo.code;
      }
      if (promo.label != null && program.promoLabel !== promo.label) {
        changes.push(`${firm.name} / ${program.name}: promoLabel ${program.promoLabel} -> ${promo.label}`);
        program.promoLabel = promo.label;
      }
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

/* ------------------------------------------------------------------ */

const SCRAPERS = {
  'blue-guardian': scrapeBlueGuardian,
  'top-one-futures': scrapeTopOne,
  'traders-launch': scrapeTradersLaunch,
  fundedseat: scrapeFundedSeat,
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
      guard(firm, res);
      const changes = [];
      apply(firm, res, changes);
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

main();
