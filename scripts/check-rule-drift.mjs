#!/usr/bin/env node
/**
 * Daily RULE-drift check for public/data/prop-firms.json.
 *
 * Independent of scripts/scrape-prop-firms.mjs (its own fetch / playwright /
 * per-firm rule extractors). It NEVER writes the JSON — the JSON is treated as
 * the source of truth and this script only *reads* the live sites to see whether
 * our manually-maintained risk rules still match.
 *
 * Fields compared: profitTarget, maxDrawdown, dailyLoss, consistency, contracts.
 * ddType / drawdown nature are deliberately NOT compared (ambiguous on buy-screens).
 *
 * Every anomaly is classified in one of two buckets:
 *   - DRIFT   : the field was read cleanly from the site but differs from our JSON
 *               (our data may be stale — a human should confirm & update the JSON).
 *   - BROKEN  : the field/plan could not be read (structure changed) — the *scraper*
 *               is what needs fixing here, this is NOT a real drift.
 * Fields that are not published on the buy-screen (manual-only) are SKIPPED and logged.
 *
 * Output: always a readable report on stdout; the same report appended to
 * $GITHUB_STEP_SUMMARY when running in CI. No Discord ping (see postAlert stub).
 * Exit code is ALWAYS 0 — this check must never break the price-sync workflow.
 *
 * Usage:
 *   node scripts/check-rule-drift.mjs              # live check, all firms
 *   node scripts/check-rule-drift.mjs --self-test  # inject a fake value, prove DRIFT classification
 */

import fs from 'node:fs';

const DATA_URL = new URL('../public/data/prop-firms.json', import.meta.url);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const FIELDS = ['profitTarget', 'maxDrawdown', 'dailyLoss', 'consistency', 'contracts'];
const BROKEN = Symbol('broken'); // rules[field] === BROKEN => anchor present-but-unreadable

/* ------------------------------------------------------------------ */
/* Normalizers (task §4)                                               */
/* ------------------------------------------------------------------ */

// Money: strip $, $$ (Blue Guardian double le signe), thousands separators
// (both "." and ","), "soft breach" wording. "None"/"—" => null.
function money(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  let s = String(v).toLowerCase().replace(/soft breach/g, '');
  if (!/\d/.test(s)) return null; // "None", "—", "N/A", ...
  const m = s.match(/[\d.,]+/);
  if (!m) return null;
  const d = m[0].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(/,/g, '');
  const n = parseFloat(d);
  return Number.isFinite(n) ? n : null;
}

// Consistency: extract the leading percentage. "40%" => "40%",
// "15% biggest trade" => "15%", "None"/null => null.
function consistency(v) {
  if (v == null) return null;
  const s = String(v).toLowerCase().trim();
  const m = s.match(/(\d+)\s*%/);
  if (m) return `${m[1]}%`;
  if (s === '' || s.includes('none') || s === 'n/a') return null;
  return s;
}

// Contracts: pull the two integers (minis, micros) regardless of format
// (site "4 Mini | 40 Micro" / "1 mini (10 micros)" vs JSON "4 minis / 40 micros").
function contracts(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  const nums = String(v).match(/\d+/g);
  if (!nums || !nums.length) return null;
  return { minis: parseInt(nums[0], 10), micros: nums[1] != null ? parseInt(nums[1], 10) : null };
}

function contractsEqual(a, b) {
  a = contracts(a);
  b = contracts(b);
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a.minis !== b.minis) return false;
  // Compare micros only when BOTH sides expose it (E8 card shows minis only).
  if (a.micros != null && b.micros != null && a.micros !== b.micros) return false;
  return true;
}

function fieldEqual(field, ours, site) {
  if (field === 'consistency') return consistency(ours) === consistency(site);
  if (field === 'contracts') return contractsEqual(ours, site);
  return money(ours) === money(site); // profitTarget, maxDrawdown, dailyLoss
}

function show(field, v) {
  if (field === 'contracts') {
    const c = contracts(v);
    return c == null ? 'null' : `${c.minis}m/${c.micros == null ? '?' : c.micros}µ`;
  }
  if (field === 'consistency') return consistency(v) == null ? 'None' : consistency(v);
  const m = money(v);
  return m == null ? 'null' : String(m);
}

/* ------------------------------------------------------------------ */
/* Fetch + generic HTML helpers                                         */
/* ------------------------------------------------------------------ */

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Strip scripts/styles/tags, one trimmed non-empty string per surviving text node.
function htmlToLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

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

/* ================================================================== */
/* Per-firm rule extractors                                            */
/* Each returns [{ programName, size, rules }] where rules maps a       */
/* compared field to a value (number/string/null) or BROKEN. A field    */
/* absent from rules = "not auto-verified for this firm/program" (skip). */
/* ================================================================== */

/* ---- Blue Guardian — structured RSC payload ---- */
const BG_PROGRAMS = { direct: 'Direct', express: 'Express', reserve: 'Reserve', standard: 'Standard' };
async function extractBlueGuardian() {
  const s = decodePayloadHtml(await fetchText('https://www.blueguardian.com/futures'));
  const idx = s.indexOf('"plans":[');
  if (idx === -1) throw new Error('"plans":[ payload not found');
  const arrText = extractBalancedArray(s, s.indexOf('[', idx));
  if (!arrText) throw new Error('unbalanced plans array');
  const payload = JSON.parse(arrText);
  const futures = payload.filter((p) => p && p.market === 'futures');
  if (futures.length === 0) throw new Error('no futures entries in payload');

  const out = [];
  for (const entry of futures) {
    const programName = BG_PROGRAMS[entry.key];
    if (!programName) continue;
    const instant = entry.key === 'direct';
    for (const size of entry.sizes ?? []) {
      const list = size.challengeRules?.length ? size.challengeRules : size.fundedRules ?? [];
      const byLabel = (label) => list.find((r) => r.label === label)?.value;
      const rules = {
        maxDrawdown: byLabel('Max Drawdown') != null ? money(byLabel('Max Drawdown')) : BROKEN,
        dailyLoss: byLabel('Daily Loss Limit') != null ? money(byLabel('Daily Loss Limit')) : null,
        contracts: byLabel('Max Position') != null ? contracts(byLabel('Max Position')) : BROKEN,
      };
      if (!instant) {
        // Eval programs advertise Profit Target + a single Consistency Rule.
        rules.profitTarget = byLabel('Profit Target') != null ? money(byLabel('Profit Target')) : BROKEN;
        rules.consistency = byLabel('Consistency Rule') != null ? consistency(byLabel('Consistency Rule')) : null;
      }
      // Direct (instant): profitTarget has no equivalent, consistency is a hand
      // summary ("20→30% payouts") of per-payout rows => intentionally not emitted.
      out.push({ programName, size: size.amount, rules });
    }
  }
  return out;
}

/* ---- Traders Launch — server-rendered cards ---- */
async function extractTradersLaunch() {
  const lines = htmlToLines(await fetchText('https://traderslaunch.com'));
  const out = [];
  for (const size of [100000, 200000, 300000]) {
    const label = `$${size.toLocaleString('en-US')}`;
    const i = lines.findIndex((l) => l === label && /Starting Capital/i.test(lines[lines.indexOf(l) + 1] || ''));
    if (i === -1) continue; // plan not found => reported as BROKEN plan
    const win = lines.slice(i, i + 30);
    const after = (labels) => {
      const j = win.findIndex((l) => labels.some((lb) => new RegExp(lb, 'i').test(l)));
      return j === -1 ? undefined : win[j + 1];
    };
    const pt = after(['^Profit Target'] );
    const dd = after(['^Max Drawdown']);
    const ct = after(['^Starting Size']);
    out.push({
      programName: '1-Step',
      size,
      rules: {
        profitTarget: pt != null ? money(pt) : BROKEN,
        maxDrawdown: dd != null ? money(dd) : BROKEN,
        contracts: ct != null ? contracts(ct) : BROKEN,
        // consistency (FAQ-only "40% rule") + dailyLoss (not advertised) stay manual.
      },
    });
  }
  return out;
}

/* ---- Top One Futures — Webflow v3 pricing panes ---- */
/* Their pricing markup was rebuilt in Aug 2026: one pane per tab
 * (`data-w-tab="X" class="acc__content__pane v3-pricing-swiper …"`, same anchors
 * as scripts/scrape-prop-firms.mjs), the tab keys changed, and two programs
 * (1-Step Elite Challenge, S2F Sim Funded) disappeared from the site.
 * Key = the `data-w-tab` attribute; the visible label can differ (the "Elite"
 * tab is labelled "Elite Daily" on screen). Value = our program name. */
const TOPONE_TABS = {
  Elite: 'Elite Daily',
  'Elite Access': 'Elite Access',
  'Instant Sim Funded': 'Instant Sim Funded',
  'Ignite Instant Funding': 'Ignite',
};
const TOPONE_SIZES = [25000, 50000, 100000, 150000];
// Rules now live in labelled rows, one per rule:
//   <div class="v3-table-row-info"><div>Profit Target</div></div>
//   <div class="v3-table-row-value"><div>$1,500</div></div>
// Label (lowercased) -> compared field. The challenge tabs and the instant tabs
// word the same rules differently ("Max Drawdown (EOD)" vs "Trailing max
// drawdown", "Consistency on Eval" vs "Consistency"), hence both spellings.
const TOPONE_ROWS = {
  'profit target': 'profitTarget',
  'max drawdown (eod)': 'maxDrawdown',
  'trailing max drawdown': 'maxDrawdown',
  'daily loss limit': 'dailyLoss',
  'consistency on eval': 'consistency',
  consistency: 'consistency',
  'max contracts': 'contracts',
};
const TOPONE_NORMALIZE = {
  profitTarget: money,
  maxDrawdown: money,
  dailyLoss: money,
  consistency,
  contracts,
};
// A promoted row keeps the superseded figure in an <em> and prints the current
// one after it ("<em>$3,000 </em>$4,000", "<em>5 </em>10"), the same old/new
// pattern as v3-price-old + v3-price-current. Drop the <em>, keep the rest;
// "None!" survives as text and the normalizers turn it into null.
function topOneRowValue(raw) {
  return raw
    .replace(/<em>[\s\S]*?<\/em>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
async function extractTopOne() {
  const html = await fetchText('https://toponefutures.com');
  const panes = [...html.matchAll(/data-w-tab="([^"]+)" class="acc__content__pane v3-pricing-swiper[^"]*"/g)];
  const out = [];
  for (const [tab, programName] of Object.entries(TOPONE_TABS)) {
    const i = panes.findIndex((m) => m[1] === tab);
    if (i === -1) throw new Error(`pricing tab pane not found: ${tab}`);
    const pane = html.slice(panes[i].index, i + 1 < panes.length ? panes[i + 1].index : html.length);
    const titles = [...pane.matchAll(/v3-pricing-title">\$(\d+)K/g)];

    for (let c = 0; c < titles.length; c++) {
      const size = parseInt(titles[c][1], 10) * 1000;
      if (!TOPONE_SIZES.includes(size)) continue;
      const card = pane.slice(titles[c].index, c + 1 < titles.length ? titles[c + 1].index : pane.length);
      // Every card holds an "Evaluation rules" and a "Funded rules" table. The
      // one flagged w--tab-active is what the page shows by default and the
      // phase our JSON stores: Eval on the challenges, Funded on the instants
      // (which have no eval at all — their two tables are identical anyway).
      const active = card.match(/data-w-tab="(?:Eval|Funded)" class="rules-tab-content w-tab-pane w--tab-active"/);
      if (!active) continue; // no rules table => reported as "plan not found"
      let block = card.slice(active.index);
      const sibling = block.indexOf('class="rules-tab-content w-tab-pane"');
      if (sibling !== -1) block = block.slice(0, sibling);

      const rules = {};
      const rows = block.matchAll(
        /v3-table-row-info"><div>([^<]*)<\/div><\/div><div class="v3-table-row-value"><div>([\s\S]*?)<\/div><\/div>/g,
      );
      for (const [, label, raw] of rows) {
        // "Daily Loss Limit" is typed with a non-breaking space on the instant
        // tabs (…Loss Limit), hence the whitespace collapse before lookup.
        const field = TOPONE_ROWS[label.replace(/\s+/g, ' ').trim().toLowerCase()];
        if (!field || field in rules) continue; // first row wins
        const value = topOneRowValue(raw);
        rules[field] = value === '' ? BROKEN : TOPONE_NORMALIZE[field](value);
      }
      // Instant tabs carry no Profit Target row => not emitted (JSON is null).
      out.push({ programName, size, rules });
    }
  }
  return out;
}

/* ---- TradeDay — server-rendered Webflow/Finsweet pricing cards ---- */
/* Every card is one `role="listitem" class="pricing_dyn w-dyn-item"` block with
 * a hidden metadata pair the client-side filter reads:
 *   <div fs-list-field="platform">Tradovate</div>
 *   <div fs-list-field="account">Quick Pay</div>
 * plus the drawdown flavour in the header title
 * (<p fs-list-field="drawdown" class="pricing_card-title">Intraday</p>).
 * account + drawdown identify the program, so the two "End of Day" programs
 * (Quick Pay EOD and Fast Pass) can't be confused. Each program/size exists
 * twice, once per platform (Tradovate, Rithmic), with the same risk rules. */
const TRADEDAY_PROGRAMS = {
  'Quick Pay|Intraday': 'Quick Pay Intraday',
  'Quick Pay|End of Day': 'Quick Pay EOD',
  'Fast Pass|End of Day': 'Fast Pass',
};
async function extractTradeDay() {
  const html = await fetchText('https://www.tradeday.com');
  const marks = [...html.matchAll(/role="listitem" class="pricing_dyn w-dyn-item"/g)];
  if (marks.length === 0) throw new Error('no pricing_dyn cards found');

  const out = [];
  const seen = new Set();
  for (let i = 0; i < marks.length; i++) {
    const card = html.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : html.length);
    const account = card.match(/fs-list-field="account">([^<]+)</);
    const flavour = card.match(/fs-list-field="drawdown" class="pricing_card-title">([^<]+)</);
    if (!account || !flavour) continue;
    const programName = TRADEDAY_PROGRAMS[`${account[1].trim()}|${flavour[1].trim()}`];
    if (!programName) continue;

    // Header: … class="text-size-large text-weight-bold text-color-primary">50k</p>
    const header = card.slice(0, card.indexOf('pricing-card_list"'));
    const sizeM = header.match(/class="text-size-large[^"]*">(\d+)k</i);
    if (!sizeM) continue;
    const size = parseInt(sizeM[1], 10) * 1000;
    const key = `${programName}|${size}`;
    if (seen.has(key)) continue; // same card again for the other platform
    seen.add(key);

    // Two bullet lists per card, "Eval Rules" then "Funded Rules". Our JSON
    // stores the eval phase (that is why Quick Pay consistency reads
    // "30% (eval only)"), so only the first list is compared.
    const from = card.indexOf('pricing-card_list"');
    const end = card.indexOf('</ul>', from);
    const bullets = htmlToLines(card.slice(from, end === -1 ? undefined : end));
    const find = (re) => {
      const l = bullets.find((b) => re.test(b));
      return l ? l.match(re) : null;
    };
    const pt = find(/^Profit Target:?\s*\$?([\d,]+)/i);
    const dd = find(/Trailing Max Drawdown:?\s*\$?([\d,]+)/i);
    const cons = find(/^Consistency:?\s*(\d+\s*%|None)/i);
    const ct = find(/Position Limits?\s*[-:]?\s*(\d+\s*Contracts?\s*\(\d+\s*Micros?\))/i);

    const rules = {
      profitTarget: pt ? money(pt[1]) : BROKEN,
      maxDrawdown: dd ? money(dd[1]) : BROKEN,
      consistency: cons ? consistency(cons[1]) : BROKEN,
      // dailyLoss: no such row on the cards => not emitted (manual null).
    };
    // Fast Pass allows fewer contracts once funded and our JSON keeps both in
    // one string ("15 contracts eval / 4 funded, +1 per $2k"), which the shared
    // contracts() normalizer would read as "4 micros" => left to a human.
    if (programName !== 'Fast Pass') rules.contracts = ct ? contracts(ct[1]) : BROKEN;
    out.push({ programName, size, rules });
  }
  return out;
}

/* ---- Legends Trading — static cards, two formats ---- */
const LEGENDS_PROGRAMS = ['Apprentice', 'Elite', 'Straight to Master'];
async function extractLegends() {
  const lines = htmlToLines(await fetchText('https://thelegendstrading.com/plans'));
  const starts = [];
  for (let i = 0; i < lines.length; i++)
    if (/^\$[\d,.]+$/.test(lines[i]) && /max/i.test(lines[i + 1] || '')) starts.push(i);

  const out = [];
  for (let c = 0; c < Math.min(starts.length, 12); c++) {
    const programName = LEGENDS_PROGRAMS[Math.floor(c / 4)];
    const i = starts[c];
    const size = money(lines[i]);
    const card = lines.slice(i, i + 18);
    const find = (re) => {
      const l = card.find((x) => re.test(x));
      return l ? l.match(re) : null;
    };
    const pt = find(/\$?([\d.,]+)\s*(?:profit goal|profit target)/i);
    const dd = find(/\$?([\d.,]+)[^\n]*trailing max loss/i);
    const cons = find(/consistency:?\s*(\d+)\s*%/i);
    const daily = find(/daily loss limit:?\s*(none|\$?[\d.,]+)/i);
    out.push({
      programName,
      size,
      rules: {
        profitTarget: pt ? money(pt[1]) : BROKEN,
        maxDrawdown: dd ? money(dd[1]) : BROKEN,
        contracts: contracts(lines[i + 1]) ?? BROKEN, // header "Max N contracts / M micros"
        consistency: cons ? `${cons[1]}%` : null,
        dailyLoss: daily ? money(daily[1]) : null,
      },
    });
  }
  return out;
}

/* ---- FundedSeat — playwright (client-rendered) ---- */
const FUNDEDSEAT_PRIMARY = '1 Step';
const FUNDEDSEAT_PROGRAMS = [
  { programName: 'Daily', sub: 'Daily' },
  { programName: 'Flex', sub: 'Flex' },
  { programName: 'Sprint', sub: 'Sprint' },
  { programName: 'Instant Funding', sub: null },
];
async function extractFundedSeat() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    throw new Error('playwright not installed');
  }
  const browser = await pw.chromium.launch({ headless: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const page = await browser.newPage({ userAgent: UA, viewport: { width: 1440, height: 900 } });
    await page.goto('https://fundedseat.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#pricing-section', { timeout: 30000 });
    await page.evaluate(() => document.querySelector('#pricing-section')?.scrollIntoView({ block: 'center' }));
    await sleep(5000);

    const readCards = () =>
      page.evaluate(() => {
        const sec = document.querySelector('#pricing-section');
        const out = [];
        for (const h3 of sec.querySelectorAll('h3')) {
          if (!/\$[\d,]+\s*Account/i.test(h3.innerText || '')) continue;
          let el = h3.parentElement;
          while (el && !/Add to Cart/i.test(el.innerText || '')) el = el.parentElement;
          if (el) out.push(el.innerText);
        }
        return out;
      });
    const buttonPresent = (label) =>
      page.evaluate((lbl) => {
        const sec = document.querySelector('#pricing-section');
        return [...sec.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === lbl);
      }, label);
    const clickTab = (label) => {
      const rx = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
      return page.locator('#pricing-section button', { hasText: rx }).first().click({ timeout: 8000 });
    };

    const out = [];
    for (const { programName, sub } of FUNDEDSEAT_PROGRAMS) {
      const target = sub ?? programName;
      if (sub && !(await buttonPresent(sub))) {
        await clickTab(FUNDEDSEAT_PRIMARY).catch(() => {});
        await sleep(700);
      }
      await clickTab(target).catch(() => {});
      await sleep(1400);
      const cards = await readCards();
      for (const text of cards) {
        const sizeM = text.match(/\$([\d,]+)\s*Account/i);
        if (!sizeM) continue;
        const after = (re) => {
          const m = text.match(re);
          return m ? m[1] : undefined;
        };
        const pt = after(/Profit Target\s*\n\s*\$([\d,]+)/i);
        const dd = after(/EOD Drawdown\s*\n\s*\$([\d,]+)/i);
        const daily = after(/Daily Loss Limit[^\n]*\n\s*(None|\$[\d,]+)/i);
        // Daily/Flex/Sprint label it "Consistency"; Instant Funding labels the
        // same rule "Biggest trade rule" (JSON stores it as "15% biggest trade").
        const cons = after(/(?:Consistency|Biggest trade rule)\s*\n\s*(\d+%|None)/i);
        const ct = after(/Max Contracts\s*\n\s*([\d]+\s*minis?\s*\/\s*[\d]+\s*micros?)/i);
        out.push({
          programName,
          size: money(sizeM[1]),
          rules: {
            profitTarget: pt != null ? money(pt) : null, // Instant Funding has no PT line
            maxDrawdown: dd != null ? money(dd) : BROKEN,
            dailyLoss: daily != null ? money(daily) : null,
            consistency: cons != null ? consistency(cons) : null,
            contracts: ct != null ? contracts(ct) : BROKEN,
          },
        });
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

/* ---- E8 Markets — playwright (Configure Challenge widget) ---- */
const E8_TABS = {
  'E8 Signature': 'E8 Signature Futures',
  'E8 Zero MAX': 'E8 Zero MAX Futures',
  'E8 Zero Starter': 'E8 Zero Starter Futures',
};
const E8_ZERO = new Set(['E8 Zero MAX Futures', 'E8 Zero Starter Futures']);
async function extractE8() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    throw new Error('playwright not installed');
  }
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('https://e8futures.com', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    const cfg = page.getByText('Configure Challenge', { exact: true }).first();
    await cfg.scrollIntoViewIfNeeded();
    await cfg.click();
    await page.waitForTimeout(2000);

    const readCards = () =>
      page.evaluate(() => {
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

    const out = [];
    for (const [tabText, programName] of Object.entries(E8_TABS)) {
      await page.locator('button', { hasText: tabText }).first().click({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const cards = await readCards();
      for (const text of cards) {
        const sizeM = /\$(\d+)K/i.exec(text);
        if (!sizeM) continue;
        const after = (re) => {
          const m = text.match(re);
          return m ? m[1] : undefined;
        };
        const pt = after(/Profit Target\s*\n\s*\$([\d,]+)/i);
        const dd = after(/Max drawdown\s*\n\s*\$([\d,]+)/i);
        const cons = after(/Consistency rule\s*\n\s*(\d+%)/i);
        const ct = after(/Max contracts\s*\n\s*(\d+)/i);
        const rules = {
          profitTarget: pt != null ? money(pt) : BROKEN,
          maxDrawdown: dd != null ? money(dd) : BROKEN,
          consistency: cons != null ? consistency(cons) : null, // Signature shows none => None
          // dailyLoss never shown on E8 cards => not emitted (manual, JSON null).
        };
        // Zero cards omit the contract limit; only Signature carries it.
        if (!E8_ZERO.has(programName)) rules.contracts = ct != null ? { minis: parseInt(ct, 10), micros: null } : BROKEN;
        out.push({ programName, size: parseInt(sizeM[1], 10) * 1000, rules });
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

const EXTRACTORS = {
  'blue-guardian': extractBlueGuardian,
  'traders-launch': extractTradersLaunch,
  'top-one-futures': extractTopOne,
  fundedseat: extractFundedSeat,
  'legends-trading': extractLegends,
  'e8-markets': extractE8,
  tradeday: extractTradeDay,
};

// Human-readable reason for the fields we knowingly do not auto-verify.
function skipReason(firmId, programName, field) {
  if (firmId === 'traders-launch' && field === 'consistency') return 'FAQ-only "40% rule" (not on card)';
  if (firmId === 'traders-launch' && field === 'dailyLoss') return 'not advertised (manual null)';
  if (firmId === 'e8-markets' && field === 'dailyLoss') return 'never shown on E8 cards (manual null)';
  if (firmId === 'e8-markets' && field === 'contracts') return 'Zero cards omit contract limit (manual)';
  if (firmId === 'blue-guardian' && field === 'profitTarget') return 'instant: no profit-target rule';
  if (firmId === 'blue-guardian' && field === 'consistency') return 'instant: hand summary of per-payout rows';
  if (firmId === 'top-one-futures' && field === 'profitTarget') return 'instant: no profit-target row on the card';
  if (firmId === 'tradeday' && field === 'dailyLoss') return 'no daily-loss row on the cards (manual null)';
  if (firmId === 'tradeday' && field === 'contracts' && programName === 'Fast Pass')
    return 'card shows the eval limit; ours bundles eval + funded ("15 eval / 4 funded")';
  return 'not published on buy-screen (manual)';
}

/* ------------------------------------------------------------------ */
/* Compare engine                                                       */
/* ------------------------------------------------------------------ */

async function runChecks(data, only) {
  const drifts = [];
  const broken = [];
  const skips = [];

  for (const firm of data.firms) {
    if (only && firm.id !== only) continue;
    const extractor = EXTRACTORS[firm.id];
    if (!extractor) {
      broken.push({ firm: firm.name, program: '(all)', size: null, field: '(firm)', detail: 'no extractor defined' });
      continue;
    }
    let plans;
    try {
      plans = await extractor();
    } catch (e) {
      broken.push({ firm: firm.name, program: '(all)', size: null, field: '(firm)', detail: `extractor failed: ${e.message}` });
      continue;
    }
    if (firm.stale) console.log(`  note: ${firm.id} is stale:true (price sync) — rules still checked below`);

    for (const program of firm.programs) {
      for (const plan of program.plans) {
        const match = plans.find((p) => p.programName === program.name && p.size === plan.size);
        if (!match) {
          broken.push({ firm: firm.name, program: program.name, size: plan.size, field: '(plan)', detail: 'plan not found on site' });
          continue;
        }
        for (const field of FIELDS) {
          const rv = match.rules[field];
          if (rv === undefined) {
            skips.push({ firm: firm.name, program: program.name, size: plan.size, field, reason: skipReason(firm.id, program.name, field) });
            continue;
          }
          if (rv === BROKEN) {
            broken.push({ firm: firm.name, program: program.name, size: plan.size, field, detail: 'field present on site but unreadable' });
            continue;
          }
          if (!fieldEqual(field, plan[field], rv)) {
            drifts.push({ firm: firm.name, program: program.name, size: plan.size, field, ours: show(field, plan[field]), site: show(field, rv) });
          }
        }
      }
    }
  }
  return { drifts, broken, skips };
}

/* ------------------------------------------------------------------ */
/* Reporting                                                            */
/* ------------------------------------------------------------------ */

function buildReport({ drifts, broken, skips }) {
  const L = [];
  L.push('# prop-firms rule-drift check');
  L.push('');
  L.push(`- REAL DRIFTS (our JSON may be stale): **${drifts.length}**`);
  L.push(`- SCRAPER BROKEN (fix the extractor, not the data): **${broken.length}**`);
  L.push(`- skipped fields (manual-only, not auto-verified): ${skips.length}`);
  L.push('');

  if (drifts.length) {
    L.push('## ⚠️ REAL DRIFTS');
    L.push('| firm | program | size | field | ours | site |');
    L.push('|---|---|---|---|---|---|');
    for (const d of drifts) L.push(`| ${d.firm} | ${d.program} | ${d.size / 1000}k | ${d.field} | ${d.ours} | ${d.site} |`);
    L.push('');
  } else {
    L.push('## ✅ No real drift — every auto-verified rule matches the JSON.');
    L.push('');
  }

  if (broken.length) {
    L.push('## 🔧 SCRAPER BROKEN');
    L.push('| firm | program | size | field | detail |');
    L.push('|---|---|---|---|---|');
    for (const b of broken) L.push(`| ${b.firm} | ${b.program} | ${b.size == null ? '-' : b.size / 1000 + 'k'} | ${b.field} | ${b.detail} |`);
    L.push('');
  }

  if (skips.length) {
    // Collapse the per-plan skips into one row per firm/field.
    const seen = new Map();
    for (const s of skips) {
      const key = `${s.firm} · ${s.field}`;
      if (!seen.has(key)) seen.set(key, s.reason);
    }
    L.push('## ⏭️ Skipped (manual-only, logged)');
    L.push('| firm · field | reason |');
    L.push('|---|---|');
    for (const [k, reason] of seen) L.push(`| ${k} | ${reason} |`);
    L.push('');
  }
  return L.join('\n');
}

/* Discord alert — DISABLED for now. Wire the real webhook here later in one line:
 *   await fetch(process.env.DISCORD_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: report }) });
 */
async function postAlert(report) {
  // TODO: activer Discord canal HEALTH via process.env.DISCORD_WEBHOOK
  console.log('[rule-drift] Discord alert disabled');
}

/* ------------------------------------------------------------------ */

async function main() {
  const selfTest = process.argv.includes('--self-test');
  const data = JSON.parse(fs.readFileSync(DATA_URL, 'utf8'));

  if (selfTest) {
    // Inject a fake truth on a known, reliably-scraped plan (BG Express 50k
    // profitTarget: 3000 -> 99999) WITHOUT writing the file, and prove the
    // engine classifies it as a REAL DRIFT.
    const prog = data.firms.find((f) => f.id === 'blue-guardian').programs.find((p) => p.name === 'Express');
    const plan = prog.plans.find((p) => p.size === 50000);
    const original = plan.profitTarget;
    plan.profitTarget = 99999;
    console.log(`[self-test] injected fake BG Express 50k profitTarget: ${original} -> 99999 (in memory only)`);
    const { drifts } = await runChecks(data, 'blue-guardian');
    const hit = drifts.find(
      (d) => d.firm === 'Blue Guardian' && d.program === 'Express' && d.size === 50000 && d.field === 'profitTarget',
    );
    console.log('\n[self-test] drifts detected:', drifts.length);
    for (const d of drifts) console.log(`  DRIFT ${d.firm}/${d.program}/${d.size / 1000}k ${d.field}: ours=${d.ours} site=${d.site}`);
    if (hit && hit.site === '3000') {
      console.log('\n[self-test] PASS — injected value classified as REAL DRIFT (ours=99999, site=3000).');
    } else {
      console.log('\n[self-test] FAIL — injected drift was not detected/classified correctly.');
    }
    return;
  }

  console.log('[rule-drift] reading live sites (rules only, never writes the JSON)…');
  const result = await runChecks(data);
  const report = buildReport(result);
  console.log('\n' + report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + report + '\n');
      console.log('\n[rule-drift] report appended to GITHUB_STEP_SUMMARY');
    } catch (e) {
      console.log(`[rule-drift] could not write GITHUB_STEP_SUMMARY: ${e.message}`);
    }
  }

  if (result.drifts.length) await postAlert(report);
}

main().catch((e) => {
  console.error(`[rule-drift] unexpected error (ignored, exit 0): ${e.stack || e.message}`);
});
