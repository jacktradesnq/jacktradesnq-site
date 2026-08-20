#!/usr/bin/env node
/**
 * Daily price sync for public/data/prop-firms.json.
 *
 * Updates ONLY: plan price / originalPrice / activationFee, program promoCode /
 * promoLabel, firm promo, firm lastChecked / stale, top-level generatedAt.
 * Risk rules (profit target, drawdown, daily loss, consistency, contracts)
 * are maintained manually and never touched here.
 *
 * activationFee is money the buyer pays, so it is scraped like a price, but
 * only for the firms whose scraper reports it (Top One today). For the others
 * the key is left exactly as it is.
 *
 * Per-firm guards: numeric price, 10 <= price <= 6000, price <= originalPrice,
 * scraped plan count must cover every plan already in the JSON for that firm.
 * Any guard failure => keep the firm's existing data, mark stale: true, log,
 * continue with the other firms. Exit code is 0 unless the JSON write fails.
 *
 * Usage: node scripts/scrape-prop-firms.mjs [--dry]
 */

import fs from 'node:fs';

import { fundedseatPlansFrom, FUNDEDSEAT_API } from './lib/fundedseat-api.mjs';

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

/* Their pricing markup was rebuilt in Aug 2026 (v3-pricing-*). The old
 * `price__text` / `price__prev` pairs are gone, the tab keys changed, and two
 * programs disappeared from the site altogether (1-Step Elite Challenge and
 * S2F Sim Funded) — which is why the scraper had been failing, and the page
 * quietly serving July prices, since 2026-07-27.
 *
 * Key = the `data-w-tab` attribute; the visible label can differ (the "Elite"
 * tab is labelled "Elite Daily" on screen). Value = our program name. */
const TOPONE_TABS = {
  Elite: 'Elite Daily',
  'Elite Access': 'Elite Access',
  'Instant Sim Funded': 'Instant Sim Funded',
  'Ignite Instant Funding': 'Ignite',
};
const TOPONE_SIZES = [25000, 50000, 100000, 150000];

// The activation fee is money, not a risk rule: on Elite Access you pay $39 to
// start and the activation fee once you pass, so leaving it hand-maintained
// meant a public page quoting a figure nobody re-checked. One row per card:
//   <div class="v3-table-row-info"><div>Activation Fee</div></div>
//   <div class="v3-table-row-value"><div>$139</div></div>
// "None!" (Elite Daily) means there is none. Fixtures for both shapes live in
// scripts/__fixtures__/, see scripts/scrape-prop-firms.test.mjs.
export function topOneActivationFees(pane) {
  const rows = [
    ...pane.matchAll(
      /v3-table-row-info"><div>Activation Fee<\/div><\/div><div class="v3-table-row-value"><div>([^<]+)<\/div>/g,
    ),
  ];
  return rows.map(([, raw]) => {
    const value = raw.trim();
    if (/^(none!?|no|n\/a|free)$/i.test(value)) return null;
    const amount = num(value.replace(/[^\d.,]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 6000) {
      throw new Error(`unreadable activation fee: "${value}"`);
    }
    return amount;
  });
}

// Each pricing tab is one <div data-w-tab="X" class="acc__content__pane v3-pricing-swiper …">.
export function topOnePane(html, tab) {
  const panes = [...html.matchAll(/data-w-tab="([^"]+)" class="acc__content__pane v3-pricing-swiper[^"]*"/g)];
  const i = panes.findIndex((m) => m[1] === tab);
  if (i === -1) throw new Error(`pricing tab pane not found: ${tab}`);
  const from = panes[i].index;
  const to = i + 1 < panes.length ? panes[i + 1].index : html.length;
  return html.slice(from, to);
}

// What a given pricing tab actually offers: the code shown inside the tab, and
// a label. The card badge is the label when it is a percentage ("55% OFF");
// Elite Access shows "SAVE NOW" instead, so fall back to the sentence the page
// attaches to that same code ("Buy 1, Get 1 FREE with Code: BOGO").
function topOneOffer(html, pane) {
  const codeM = pane.match(/v2-copy-text">([A-Z0-9.]{2,15})</);
  if (!codeM) return null;
  const code = codeM[1];
  const badge = pane.match(/v3-pricing-discount[^>]*><div>([^<]+)</);
  const badgeTxt = badge ? badge[1].trim() : '';
  if (/^\d+% off$/i.test(badgeTxt)) return { code, label: badgeTxt.toUpperCase() };
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phrase = html.match(
    new RegExp(`>([^<]{5,40}) w(?:ith|\\.) Code:</div>[\\s\\S]{0,400}?v2-copy-text">${escaped}<`, 'i'),
  );
  return phrase ? { code, label: phrase[1].trim().toUpperCase() } : { code, label: null };
}

async function scrapeTopOne() {
  const html = await fetchText('https://toponefutures.com');
  const updates = [];
  const programPromos = {};

  for (const [tab, programName] of Object.entries(TOPONE_TABS)) {
    const pane = topOnePane(html, tab);
    const offer = topOneOffer(html, pane);
    if (offer && offer.label) programPromos[programName] = offer;
    // One card per size: title carries the size ("$25K Evaluation" / "$25K Account"),
    // then the struck-through list price and the price you pay today.
    const cards = [...pane.matchAll(
      /v3-pricing-title">\$(\d+)K[^<]*<\/div>[\s\S]{0,3000}?<div class="v3-price-current">\$([\d,]+)/g,
    )];
    if (cards.length !== TOPONE_SIZES.length)
      throw new Error(`${tab}: expected ${TOPONE_SIZES.length} pricing cards, got ${cards.length}`);

    const olds = [...pane.matchAll(/v3-price-old">\$([\d,]+)/g)].map((m) => num(m[1]));
    if (olds.length !== cards.length)
      throw new Error(`${tab}: ${cards.length} cards but ${olds.length} struck-through prices`);

    const activations = topOneActivationFees(pane);
    if (activations.length !== cards.length)
      throw new Error(`${tab}: ${cards.length} cards but ${activations.length} activation fee rows`);

    cards.forEach((m, i) => {
      const size = num(m[1]) * 1000;
      if (size !== TOPONE_SIZES[i])
        throw new Error(`${tab}: card ${i} is $${size / 1000}K, expected $${TOPONE_SIZES[i] / 1000}K`);
      updates.push({
        programName,
        size,
        price: num(m[2]),
        originalPrice: olds[i],
        activationFee: activations[i],
      });
    });
  }

  // Site-wide banner: "55% off EVERYTHING w. code: 2.0". It is the code that
  // produces the prices above — the per-card badges only repeat the percentage.
  let firmPromo;
  const banner = html.match(/<strong>(\d+)% off[^<]*w\. code:<\/strong><\/div>[\s\S]{0,400}?v2-copy-text">([A-Z0-9.]{2,15})</i);
  if (banner) firmPromo = { label: `${banner[1]}% OFF`, code: banner[2] };

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

// FundedSeat's pricing tab row has two INDEPENDENT axes:
//   primary  = { "1 Step", "Instant Funding" }  (challenge type)
//   variants = { "Daily", "Flex", "Sprint" }     (payout variant, only shown under "1 Step")
// The variant buttons are removed from the DOM whenever "Instant Funding" is active, so the
// primary "1 Step" tab must be re-clicked to restore them before selecting Daily/Flex/Sprint.
// programName here must match the JSON program names exactly ("1 Step" default = the Daily variant).
const FUNDEDSEAT_PRIMARY = '1 Step';
const FUNDEDSEAT_PROGRAMS = [
  { programName: 'Daily', sub: 'Daily' },
  { programName: 'Flex', sub: 'Flex' },
  { programName: 'Sprint', sub: 'Sprint' },
  { programName: 'Instant Funding', sub: null }, // top-level tab, no payout sub-variant
];
const MONTHS = { JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12 };

async function scrapeFundedSeat() {
  // Their own backend answers for 11 of our 15 plans. It is the second witness:
  // the cards are what a buyer is shown, the API is what their system charges,
  // and a disagreement between the two is not ours to resolve silently.
  const apiPlans = fundedseatPlansFrom(JSON.parse(await fetchText(FUNDEDSEAT_API)));

  let pw;
  try {
    pw = await import('playwright');
  } catch {
    // Flex has no API counterpart, so 11/15 plans cannot satisfy the full-coverage
    // guard: skip the firm exactly as before rather than write a partial update.
    console.log(`fundedseat: ${apiPlans.length} plans read from their API, but Flex needs playwright — skipped`);
    return null;
  }
  const browser = await pw.chromium.launch({ headless: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Helpers ported from the verified reference scraper — all scoped to #pricing-section.
  const readCards = (page) =>
    page.evaluate(() => {
      const sec = document.querySelector('#pricing-section');
      const out = [];
      for (const h3 of sec.querySelectorAll('h3')) {
        if (!/\$[\d,]+ Account/i.test(h3.innerText || '')) continue;
        let el = h3.parentElement;
        while (el && !/Add to Cart/i.test(el.innerText || '')) el = el.parentElement;
        if (el) out.push(el.innerText);
      }
      return out;
    });
  const sizeButtonCount = (page) =>
    page.evaluate(() => {
      const sec = document.querySelector('#pricing-section');
      return [...sec.querySelectorAll('button')].filter((b) => /^\$[\d,]+$/.test((b.innerText || '').trim())).length;
    });
  const isActive = (page, label) =>
    page.evaluate((lbl) => {
      const sec = document.querySelector('#pricing-section');
      const t = [...sec.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === lbl);
      return t ? /active/i.test(t.className) : null; // null => button not present
    }, label);
  const buttonPresent = (page, label) =>
    page.evaluate((lbl) => {
      const sec = document.querySelector('#pricing-section');
      return [...sec.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === lbl);
    }, label);
  const clickTab = (page, label) => {
    const rx = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
    return page.locator('#pricing-section button', { hasText: rx }).first().click({ timeout: 8000 });
  };
  // Anti-"Bolt" guard: after clicking a tab, wait until cards truly reflect it and are stable.
  const waitStableCards = async (page, targetLabel) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const activeOk = (await isActive(page, targetLabel)) === true;
      const read1 = await readCards(page);
      await sleep(450);
      const read2 = await readCards(page);
      const stable = read1.length > 0 && read1.join('|||') === read2.join('|||');
      const sizes = read2.map((c) => (c.match(/\$([\d,]+)\s*Account/i) || [])[1]);
      const dup = sizes.length !== new Set(sizes).size;
      const bolt = read2.some((c) => /bolt/i.test(c));
      const allCart = read2.every((c) => /Add to Cart/i.test(c));
      const expected = await sizeButtonCount(page);
      const countOk = expected === 0 ? read2.length > 0 : read2.length === expected;
      if (activeOk && stable && !dup && !bolt && allCart && read2.length > 0 && countOk) return read2;
      console.log(`  fundedseat: "${targetLabel}" unstable attempt ${attempt} (active=${activeOk} stable=${stable} dup=${dup} count=${read2.length}/${expected}) — retrying`);
      await clickTab(page, targetLabel).catch(() => {});
      await sleep(900 + attempt * 400);
    }
    return await readCards(page); // best-effort read after exhausting retries
  };

  try {
    const page = await browser.newPage({ userAgent: UA, viewport: { width: 1440, height: 900 } });
    await page.goto('https://fundedseat.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#pricing-section', { timeout: 30000 });
    await page.evaluate(() => document.querySelector('#pricing-section')?.scrollIntoView({ block: 'center' }));
    await sleep(2500); // let styled-components / lazy render settle

    const updates = [];
    for (const { programName, sub } of FUNDEDSEAT_PROGRAMS) {
      const target = sub ?? programName; // Instant Funding is a primary tab, no sub-variant
      // Restore the Daily/Flex/Sprint variant row if a prior "Instant Funding" click removed it.
      if (sub && !(await buttonPresent(page, sub))) {
        await clickTab(page, FUNDEDSEAT_PRIMARY).catch(() => {});
        await sleep(700);
      }
      await clickTab(page, target).catch((e) => console.log(`  fundedseat: click "${target}" failed: ${e.message.split('\n')[0]}`));
      await sleep(600);

      const cardTexts = await waitStableCards(page, target);
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

    // Cross-check every plan both sources describe. Tab clicking is the weak
    // link here (their variant buttons swap the cards under us, which is why the
    // "Bolt" guard above exists), so a card that disagrees with their backend is
    // treated as a bad read and stops the firm instead of publishing a guess.
    for (const api of apiPlans) {
      const card = updates.find((u) => u.programName === api.programName && u.size === api.size);
      if (!card) throw new Error(`${api.programName} $${api.size / 1000}K: in their API, missing from the cards`);
      if (card.price !== api.price || card.originalPrice !== api.originalPrice)
        throw new Error(
          `${api.programName} $${api.size / 1000}K: card says $${card.price}/$${card.originalPrice}, ` +
            `their API says $${api.price}/$${api.originalPrice}`,
        );
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
/* LEGENDS Trading — static Webflow HTML on https://thelegendstrading.com/plans */
/* ------------------------------------------------------------------ */

// Their Webflow page serves a STALE price table to any HTTP client: verified
// 2026-08-20 with this scraper's own user-agent and a cache-buster, the HTML
// said Apprentice 50K was $185 -> $37/mo while the rendered page said
// $59 -> $29.50. The string "29.50" appears nowhere in that HTML. The old
// extractor happily "verified 12 plans, no changes" against numbers no visitor
// ever sees.
//
// The rendered page gets its prices from their own public shop API, which is
// plain HTTP and needs no browser. That is what we read now.
//
// Field trap: `price` is the STRUCK price and `strikeThroughPrice` is what the
// buyer pays. Their names are inverted, confirmed against the rendered card
// showing "$59 $29.50" for price 59 / strikeThroughPrice 29.5.
const LEGENDS_API =
  'https://api.thelegendstrading.com/shop/plans?purchasableOnly=true&broker=Tradovate';

// "$50,000" and "$50,000 Elite" both mean the 50K account.
function legendsSize(storeDisplayName) {
  const m = /\$([\d,]+)/.exec(String(storeDisplayName ?? ''));
  return m ? num(m[1]) : null;
}

// The description carries the rules and the fee, one per line:
//   "$99 Activation Fee" (Apprentice) or "Activation Fee: None" (Elite)
export function legendsActivationFee(description) {
  const text = String(description ?? '');
  if (/activation fee\s*:\s*none/i.test(text)) return null;
  const m = /\$([\d,.]+)\s*activation fee/i.exec(text);
  if (!m) return null;
  const fee = num(m[1]);
  if (!Number.isFinite(fee) || fee <= 0 || fee > 6000) {
    throw new Error(`unreadable LEGENDS activation fee: "${m[0]}"`);
  }
  return fee;
}

// Their August promotion, from the asset LEGENDS sent Angelo with his own code
// on it: the 50K Elite is $49 on a FIRST order and $98 after. Their shop API
// only exposes the repeat price ($98.15), so the promo price is pinned here.
//
// `until` is what keeps this honest: past that date the override stops applying
// and the API price comes back on its own, instead of a stale $49 living on the
// page forever. The note next to it is set once in prop-firms.json.
const LEGENDS_PROMO = {
  programName: 'Elite',
  size: 50000,
  price: 49,
  until: '2026-08-22', // leur mail: promo jusqu'au vendredi 21 aout 23h59 ET
  source: 'August promotion asset, "$49 FIRST ORDER, $98 OTHER ORDERS", code JTNQ',
};

export function applyLegendsPromo(updates, today = TODAY) {
  if (today >= LEGENDS_PROMO.until) return updates;
  return updates.map((u) =>
    u.programName === LEGENDS_PROMO.programName && u.size === LEGENDS_PROMO.size
      ? { ...u, price: LEGENDS_PROMO.price }
      : u,
  );
}

export function legendsUpdatesFrom(payload) {
  const plans = payload?.data;
  if (!Array.isArray(plans) || plans.length === 0) throw new Error('LEGENDS API returned no plans');

  const updates = [];
  for (const plan of plans) {
    if (plan.isPublic === false) continue;
    const size = legendsSize(plan.storeDisplayName);
    const paid = plan.strikeThroughPrice; // what the buyer pays, despite the name
    const listed = plan.price; // the struck-through one
    if (!size || !Number.isFinite(paid) || !Number.isFinite(listed)) {
      throw new Error(`LEGENDS plan unreadable: ${JSON.stringify(plan.storeDisplayName)}`);
    }
    if (paid > listed) {
      throw new Error(
        `LEGENDS ${plan.productCategory} ${size}: paid ${paid} > listed ${listed}, the two fields may have been swapped back`,
      );
    }
    updates.push({
      programName: plan.productCategory,
      size,
      price: paid,
      originalPrice: listed,
      activationFee: legendsActivationFee(plan.description),
    });
  }
  return updates;
}

async function scrapeLegends() {
  const res = await fetch(LEGENDS_API, {
    headers: { 'user-agent': UA, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for the LEGENDS shop API`);
  return { updates: applyLegendsPromo(legendsUpdatesFrom(await res.json())) };
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

/* ------------------------------------------------------------------ */
/* TradeDay — Webflow CMS cards on https://www.tradeday.com, filtered      */
/* client-side by fs-list-field attributes (drawdown / platform / account) */
/* ------------------------------------------------------------------ */

// account + drawdown -> our program name. Every card is duplicated per trading
// platform, so the same (program, size) shows up more than once; the prices
// must agree or we refuse the update.
const TRADEDAY_PROGRAMS = {
  'Quick Pay|Intraday': 'Quick Pay Intraday',
  'Quick Pay|End of Day': 'Quick Pay EOD',
  'Fast Pass|End of Day': 'Fast Pass',
};

async function scrapeTradeDay() {
  const html = await fetchText('https://www.tradeday.com');
  const starts = [...html.matchAll(/class="pricing_dyn w-dyn-item"/g)].map((m) => m.index);
  if (starts.length === 0) throw new Error('no pricing cards found');

  const seen = new Map(); // "program|size" -> { price, originalPrice }
  for (let i = 0; i < starts.length; i++) {
    const card = html.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : undefined);
    const drawdown = card.match(/fs-list-field="drawdown"[^>]*>([^<]+)</)?.[1].trim();
    const account = card.match(/fs-list-field="account"[^>]*>([^<]+)</)?.[1].trim();
    const programName = TRADEDAY_PROGRAMS[`${account}|${drawdown}`];
    if (!programName) continue; // a product we do not list

    const sizeM = card.match(/text-color-primary">(\d+)k</i);
    const prices = [...card.matchAll(/display-inline">\$<\/div><div class="display-inline">([\d,]+)</g)].map((m) => num(m[1]));
    if (!sizeM || prices.length !== 2)
      throw new Error(`${programName}: card ${i} has no size or ${prices.length} prices (expected 2)`);

    const key = `${programName}|${num(sizeM[1]) * 1000}`;
    const found = { originalPrice: prices[0], price: prices[1] };
    const prev = seen.get(key);
    if (prev && (prev.price !== found.price || prev.originalPrice !== found.originalPrice))
      throw new Error(`${key}: two cards disagree ($${prev.price}/$${prev.originalPrice} vs $${found.price}/$${found.originalPrice})`);
    seen.set(key, found);
  }

  const updates = [...seen.entries()].map(([key, v]) => {
    const [programName, size] = key.split('|');
    return { programName, size: Number(size), ...v };
  });
  return { updates };
}

/* ------------------------------------------------------------------ */

const SCRAPERS = {
  'blue-guardian': scrapeBlueGuardian,
  'top-one-futures': scrapeTopOne,
  'traders-launch': scrapeTradersLaunch,
  fundedseat: scrapeFundedSeat,
  tradeday: scrapeTradeDay,
  'legends-trading': scrapeLegends,
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

// Importable for tests without running the sync.
if (process.argv[1] && process.argv[1].endsWith('scrape-prop-firms.mjs')) main();
