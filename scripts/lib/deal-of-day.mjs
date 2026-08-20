// Daily prop-firm deal engine.
//
// Every figure it prints is read from public/data/prop-firms.json (scraped by
// scripts/scrape-prop-firms.mjs). Nothing here invents a price, a rule or a
// discount: if the data does not carry it, the copy does not mention it.
//
// The wording is NOT here: every sentence comes from content/newsletter/,
// which Angelo edits without touching code. This file decides which firm, and
// hands the numbers to the templates. See scripts/lib/copy.mjs.

import { loadCopy, fill, assertComplete, parseLabels } from './copy.mjs';

const URGENCY_WINDOW_H = 96; // a promo ending inside 4 days is the day's headline
const COOLDOWN_DAYS = 7; // never headline the same firm twice in a week

// ── helpers ──────────────────────────────────────────────────────────────────

const money = (n) =>
  `$${Number(n).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}`;

const sizeLabel = (n) => `${Math.round(n / 1000)}K`;

const usd = (n) => Number(n).toLocaleString('en-US');

// Scraped fields such as "Daily · 5h guaranteed" are fine in a table and awful
// mid-sentence. Prose gets commas.
const prose = (s) => String(s ?? '').replace(/\s*·\s*/g, ', ').trim();

// "E8 Markets" + "E8 Zero MAX Futures" reads as a stutter: drop the repeat.
function programLabelOf(firmName, programName) {
  const first = firmName.split(/\s+/)[0];
  const re = new RegExp(`^${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
  const stripped = programName.replace(re, '').trim();
  return stripped || programName;
}

// The size traders actually compare against each other.
const REFERENCE_SIZE = 50000;

// Raster copies of the firm logos, for email: Gmail strips SVG.
// Built by scripts/build-email-logos.sh into public/logos/email/.
const LOGO_BASE = 'https://jacktradesnq.com/logos/email';

// An evaluation is not a funded account. Saying "funded" about a challenge is
// the one wording mistake that would cost credibility with traders.
const accountPhrase = (deal) =>
  `${sizeLabel(deal.headline.size)} ${deal.programType === 'instant' ? 'instant funded account' : 'challenge'}`;

const dayStart = (iso) => Date.parse(`${iso}T00:00:00Z`);
const dayEnd = (iso) => Date.parse(`${iso}T23:59:59Z`);

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (iso) => WEEKDAY[new Date(dayStart(iso)).getUTCDay()];

function discountPct(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round((1 - price / originalPrice) * 100);
}

// ── change detection ─────────────────────────────────────────────────────────

// A snapshot is what yesterday's run saw: promo identity + every plan price.
// Diffing two snapshots is how "new promo" and "price drop" are detected
// without re-scraping anything.
export function snapshotOf(data) {
  const out = {};
  for (const firm of data.firms) {
    const prices = {};
    for (const program of firm.programs ?? []) {
      for (const plan of program.plans ?? []) prices[`${program.name}|${plan.size}`] = plan.price;
    }
    out[firm.id] = {
      promoKey: firm.promo ? `${firm.promo.label}|${firm.promo.code}|${firm.promo.ends ?? ''}` : null,
      prices,
    };
  }
  return { generatedAt: data.generatedAt, firms: out };
}

function diffAgainst(prevSnapshot, firm) {
  const prev = prevSnapshot?.firms?.[firm.id];
  if (!prev) return { newPromo: false, dropPct: 0 };

  const promoKey = firm.promo
    ? `${firm.promo.label}|${firm.promo.code}|${firm.promo.ends ?? ''}`
    : null;
  const newPromo = Boolean(promoKey) && promoKey !== prev.promoKey;

  let dropPct = 0;
  for (const program of firm.programs ?? []) {
    for (const plan of program.plans ?? []) {
      const before = prev.prices[`${program.name}|${plan.size}`];
      if (before && plan.price < before) {
        dropPct = Math.max(dropPct, Math.round((1 - plan.price / before) * 100));
      }
    }
  }
  return { newPromo, dropPct };
}

// ── candidate building ───────────────────────────────────────────────────────

// The size comes first, the discount second.
//
// Top One prices every Elite Access size at $39, so the percentage off is just
// an artefact of the list price and "biggest % off" pointed at the 150K, the
// size nobody quotes. So: pick the reference size the firm actually sells
// (50K, or the closest it has), then the best deal within that size.
function headlineOf(firm) {
  const pairs = [];
  for (const program of firm.programs ?? []) {
    for (const plan of program.plans ?? []) pairs.push({ program, plan });
  }
  if (pairs.length === 0) return null;

  const sizes = [...new Set(pairs.map((p) => p.plan.size))];
  const targetSize = sizes.reduce((a, b) =>
    Math.abs(b - REFERENCE_SIZE) < Math.abs(a - REFERENCE_SIZE) ? b : a
  );

  // Then the cheapest way to actually get funded, NOT the biggest percentage.
  //
  // A percentage hides the fee that comes after. LEGENDS Apprentice is 80% off
  // at $37/mo and charges $99 once you pass, so $136 minimum, while Elite shows
  // 35% off at $96.85 and charges nothing after: Elite is the cheaper path.
  // Top One Elite Access is worse still, $39 with a $189 activation, so $228 to
  // get funded against a $218 struck price it claims 82% off.
  //
  // Monthly plans count one month, the floor, and their card says they are
  // billed monthly.
  const costToFunded = (plan) => plan.price + (plan.activationFee ?? 0);

  let best = null;
  for (const { program, plan } of pairs.filter((p) => p.plan.size === targetSize)) {
    const pct = discountPct(plan.price, plan.originalPrice);
    const cand = { program, plan, pct, cost: costToFunded(plan) };
    if (
      !best ||
      cand.cost < best.cost ||
      (cand.cost === best.cost && cand.pct > best.pct)
    ) {
      best = cand;
    }
  }
  if (!best) return null;

  // No struck-through price at that size: the firm still has an affiliate
  // discount (codeDiscountPct) or a flat price.
  if (best.pct === 0) {
    const cheapest = best;

    // Same rule as effectivePrice() in app/prop-firms/page.tsx: the code comes
    // off the listed price, so the newsletter and the page never disagree.
    if (firm.codeDiscountPct != null && cheapest.plan.originalPrice == null) {
      return {
        program: cheapest.program,
        plan: cheapest.plan,
        pct: firm.codeDiscountPct,
        pctSource: 'firm.codeDiscountPct',
        priceOverride: Math.round(cheapest.plan.price * (1 - firm.codeDiscountPct / 100) * 100) / 100,
        wasOverride: cheapest.plan.price,
      };
    }
    return { program: cheapest.program, plan: cheapest.plan, pct: 0, pctSource: null };
  }
  return { program: best.program, plan: best.plan, pct: best.pct, pctSource: 'plan.originalPrice' };
}

// Which catches apply comes from the data; how they are worded comes from
// content/newsletter/messages.md.
function caveatsOf(program, plan, messages) {
  const values = {
    consistency: plan.consistency ?? '',
    activation: plan.activationFee ? money(plan.activationFee) : '',
  };
  const say = (block) => fill(messages[block], values, { blockName: block });

  const out = [];
  if (program.priceType === 'monthly') {
    out.push({ text: say('catch.monthly'), source: 'program.priceType' });
  }
  // No caveat derived from ddType. FundedSeat's buy screen says "EOD Drawdown"
  // and the word trailing appears nowhere on their site, while Blue Guardian's
  // own tooltip says "EOD, static, no trailing": the label means different
  // things firm by firm, the daily rule check cannot read it, so nothing here
  // asserts a behaviour from it. The amount and the label are printed as is.
  if (plan.consistency && !/^(none|no|n\/a)$/i.test(String(plan.consistency).trim())) {
    out.push({ text: say('catch.consistency'), source: 'plan.consistency' });
  }
  if (plan.activationFee) {
    out.push({ text: say('catch.activation'), source: 'plan.activationFee' });
  }
  return out.slice(0, 2);
}

// His code, never the firm's public one.
//
// A public code (BG25, ULTRA50, LTG, BOGO) gives the reader the same discount
// while pushing him out of the transaction wherever a firm attributes by code,
// and it wastes the point of the newsletter. So the only codes that can be
// printed are the ones declared in content/newsletter/codes.md.
//
// `link` there means: print no code, the affiliate link carries both the
// discount and the attribution. An undeclared firm falls back to JTNQ, the same
// default as chipCode() in app/prop-firms/page.tsx, and is reported.
const AFFILIATE_CODE = 'JTNQ';

function codeFor(firm, codes) {
  const declared = codes?.[firm.id];
  if (!declared) return { code: AFFILIATE_CODE, undeclared: true, viaLink: false };
  // "link" is a decision, not a guess about the URL shape: fundedseat.link/jtnq
  // carries the affiliation in its path, with no query parameter to sniff.
  if (declared.toLowerCase() === 'link') return { code: null, undeclared: false, viaLink: true };
  return { code: declared, undeclared: false, viaLink: false };
}

function candidateFor(firm, { today, prevSnapshot, messages, codes }) {
  if (firm.stale) return null; // scrape failed, old numbers kept: never headline it
  const head = headlineOf(firm);
  if (!head) return null;

  const { program, plan } = head;
  const promo = program.promoCode
    ? { label: program.promoLabel ?? null, code: program.promoCode, ends: undefined }
    : firm.promo ?? null;
  const ourCode = codeFor(firm, codes);

  const endsAt = promo?.ends ?? null;
  const hoursLeft = endsAt ? Math.round((dayEnd(endsAt) - dayStart(today)) / 3.6e6) : null;
  const expiring = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= URGENCY_WINDOW_H;

  const { newPromo, dropPct } = diffAgainst(prevSnapshot, firm);

  const signals = [];
  let score = head.pct;
  if (expiring) {
    signals.push('expiring');
    score += 1000 + (URGENCY_WINDOW_H - hoursLeft);
  }
  if (newPromo) {
    signals.push('new-promo');
    score += 500;
  }
  if (dropPct > 0) {
    signals.push('price-drop');
    score += 300 + Math.min(100, dropPct);
  }

  const viaCode = head.pctSource === 'firm.codeDiscountPct';
  const ladder = (program.plans ?? [])
    .slice()
    .sort((a, b) => a.size - b.size)
    .map((p) =>
      viaCode
        ? {
            size: p.size,
            price: Math.round(p.price * (1 - firm.codeDiscountPct / 100) * 100) / 100,
            originalPrice: p.price,
          }
        : { size: p.size, price: p.price, originalPrice: p.originalPrice }
    );

  return {
    firmId: firm.id,
    firmName: firm.name,
    logo: `${LOGO_BASE}/${firm.id}.png`,
    url: firm.url,
    code: ourCode.code,
    codeUndeclared: ourCode.undeclared,
    codeViaLink: ourCode.viaLink,
    publicCode: program.promoCode ?? firm.promo?.code ?? null, // never printed, kept for the audit
    split: firm.split,
    payout: firm.payout,
    lastChecked: firm.lastChecked,
    programName: program.name,
    programLabel: programLabelOf(firm.name, program.name),
    programType: program.type,
    priceType: program.priceType,
    promoLabel: promo?.label ?? null,
    endsAt,
    hoursLeft,
    headline: {
      size: plan.size,
      price: head.priceOverride ?? plan.price,
      originalPrice: head.wasOverride ?? plan.originalPrice,
      discountPct: head.pct,
      discountSource: head.pctSource,
      priceType: program.priceType,
    },
    rules: {
      profitTarget: plan.profitTarget,
      maxDrawdown: plan.maxDrawdown,
      ddType: plan.ddType,
      dailyLoss: plan.dailyLoss,
      dailyLossSoft: plan.dailyLossSoft ?? false,
      contracts: plan.contracts,
      consistency: plan.consistency ?? null,
      activationFee: plan.activationFee ?? null,
    },
    ladder,
    caveats: caveatsOf(program, plan, messages),
    signals,
    score,
  };
}

export function analyzeFirms(data, { today, prevSnapshot = null } = {}) {
  const { messages, codes } = loadCopy();
  assertComplete(messages);
  return data.firms
    .map((f) => candidateFor(f, { today, prevSnapshot, messages, codes }))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.firmId.localeCompare(b.firmId));
}

export function pickDeal(data, { today, history = [], prevSnapshot = null, forceFirmId = null } = {}) {
  const candidates = analyzeFirms(data, { today, prevSnapshot });
  if (forceFirmId) return candidates.find((c) => c.firmId === forceFirmId) ?? null;

  const cooldown = new Set(
    history
      .filter((h) => (dayStart(today) - dayStart(h.date)) / 8.64e7 < COOLDOWN_DAYS)
      .map((h) => h.firmId)
  );
  return candidates.find((c) => !cooldown.has(c.firmId)) ?? candidates[0] ?? null;
}

// ── copy ─────────────────────────────────────────────────────────────────────

const per = (deal) => (deal.priceType === 'monthly' ? '/mo' : '');

// A monthly plan discounted from a monthly price: both figures carry /mo, or
// the reader compares a subscription against a one-off.
const at = (deal, n) => `${money(n)}${per(deal)}`;

function priceLine(deal) {
  const h = deal.headline;
  return h.originalPrice ? `${at(deal, h.price)} instead of ${at(deal, h.originalPrice)}` : at(deal, h.price);
}

function endsClause(deal) {
  if (!deal.signals.includes('expiring')) return '';
  return ` Ends ${weekdayOf(deal.endsAt)}.`;
}

// The short form used by the tweet and by Discord. Same ownership rule as the
// rest: the words live in content/newsletter/messages.md.
function codeLine(deal, messages, values) {
  if (deal.code) return say(messages, 'code_line', values);
  if (deal.codeViaLink) return say(messages, 'code_line_in_link', values);
  return '';
}

// Everything a template can reach. An empty string means "no such thing
// today", which collapses any [group] that mentions it.
function valuesFor(deal, { takes = {} } = {}) {
  const h = deal.headline;
  const r = deal.rules;
  const values = {
    firm: deal.firmName,
    plan: deal.programLabel,
    account: accountPhrase(deal),
    size: sizeLabel(h.size),
    price: at(deal, h.price),
    was: h.originalPrice ? at(deal, h.originalPrice) : '',
    discount: h.discountPct ? String(h.discountPct) : '',
    split: deal.split,
    payout: prose(deal.payout),
    ddtype: r.ddType ?? '',
    target: r.profitTarget ? `$${usd(r.profitTarget)}` : '',
    maxdd: r.maxDrawdown ? `$${usd(r.maxDrawdown)}` : '',
    dailyloss: r.dailyLoss ? `$${usd(r.dailyLoss)}` : '',
    contracts: r.contracts ?? '',
    consistency: r.consistency ?? '',
    activation: r.activationFee ? money(r.activationFee) : '',
    code: deal.code ?? '',
    url: deal.url,
    ends: deal.signals.includes('expiring') ? weekdayOf(deal.endsAt) : '',
    checked: deal.lastChecked,
    ladder: deal.ladder.map((p) => `${sizeLabel(p.size)} ${at(deal, p.price)}`).join(' · '),
    take: '',
  };
  const take = takes[deal.firmId];
  values.take = take ? fill(take, values, { blockName: `takes.md ${deal.firmId}` }) : '';
  return values;
}

function say(messages, block, values, options) {
  return fill(messages[block], values, { blockName: block, ...options });
}

export function renderTweet(deal) {
  const { messages, takes } = loadCopy();
  const values = valuesFor(deal, { takes });
  const code = codeLine(deal, messages, values);
  return [
    say(messages, 'tweet', values),
    code ? `${code}: ${deal.url}` : deal.url,
  ].join('\n');
}

export function renderDiscord(deal) {
  const { messages, takes } = loadCopy();
  const values = valuesFor(deal, { takes });
  const lines = [say(messages, 'discord', values)];
  if (values.take) lines.push('', `${say(messages, 'email.take_title', values)}: ${values.take}`);
  if (deal.caveats.length) {
    lines.push('', `${say(messages, 'email.catch_title', values)}:`, ...deal.caveats.map((c) => `- ${c.text}`));
  }
  const code = codeLine(deal, messages, values);
  lines.push('', code ? `${code} · <${deal.url}>` : `<${deal.url}>`);
  lines.push(say(messages, 'email.footer', values));
  return lines.join('\n');
}

// ── the no-stacking audit ────────────────────────────────────────────────────

// A firm's own promo text brags things like "45% OFF + 50% w/ code ULTRA50".
// Those two numbers are alternatives, not a sum: no prop firm stacks discounts.
// So the only discount this engine will ever state is the one it can do the
// arithmetic for, on a single plan's own two prices. This walks the finished
// messages and refuses anything else, including a percentage typed by hand into
// the copy file.
//
// It also cannot vouch for a coupon: the scraper reads the PUBLIC price off the
// pricing page ("Add to Cart $original $promo"), and a code applies at the
// checkout, which nothing here can observe. The price we print is the public
// one, and the copy sends the reader to the checkout with the code.
export function auditDiscountClaims(deal, renderings) {
  const computed = deal.headline.discountPct ? String(deal.headline.discountPct) : null;
  const problems = [];
  for (const [channel, text] of Object.entries(renderings)) {
    for (const [, pct] of String(text ?? '').matchAll(/(\d+)\s*%\s*off/gi)) {
      if (pct !== computed) {
        problems.push(
          `${channel}: claims "${pct}% off" but the only discount computed from the data is ` +
            `${computed ? `${computed}%` : 'none'} (${deal.firmName}, ${deal.programName})`
        );
      }
    }
  }
  return problems;
}

// A firm's public code must never appear in a message: the reader would type it
// instead of his, and wherever a firm attributes by code that is a commission
// he does not get.
export function auditCodeClaims(deal, renderings) {
  const problems = [];
  if (!deal.publicCode || deal.publicCode === deal.code) return problems;

  const needle = deal.publicCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = new RegExp(`(^|[^A-Za-z0-9])${needle}([^A-Za-z0-9]|$)`);
  for (const [channel, text] of Object.entries(renderings)) {
    if (boundary.test(String(text ?? ''))) {
      problems.push(
        `${channel}: prints the public code "${deal.publicCode}" instead of ` +
          `${deal.code ? `"${deal.code}"` : 'no code at all'} (${deal.firmName})`
      );
    }
  }
  return problems;
}

// ── email ────────────────────────────────────────────────────────────────────

// Same dark editorial palette as the site (.bd-root in app/globals.css): warm
// bottle-green black, one gold accent. Written in hex on purpose: email clients
// do not read oklch, and CSS variables do not survive Gmail.
const C = {
  surface: '#02130C',
  card: '#071C13',
  raised: '#0C2018',
  ink: '#F3EFDC',
  muted: '#839180',
  border: '#1C3329',
  borderSoft: '#152920',
  gold: '#E9B44B',
  goldDeep: '#D29922',
  terraSoft: '#3D2013',
};
// Fraunces and Satoshi are self-hosted, so no email client will load them:
// Georgia italic keeps the serif display voice, the rest falls back cleanly.
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, Menlo, Consolas, 'Courier New', monospace";
const SEP = '&#183;'; // interpunct as an entity: a raw byte shows up as mojibake

// Everything interpolated goes through here. Non-ASCII becomes a numeric entity
// because a scraped "50->90%" arrow or an accent renders as garbage without a
// charset header we do not control.
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x00-\x7F]/g, (ch) => `&#${ch.codePointAt(0)};`);

// Inbox lists cut a subject around 70 characters, so an over-long one is
// re-rendered without the struck-through price rather than chopped mid-word.
function subjectOf(messages, values) {
  const full = say(messages, 'email.subject', values);
  if (full.length <= 70) return full;
  return say(messages, 'email.subject', { ...values, was: '' }).slice(0, 70);
}

// Target, drawdown and daily loss are what a trader actually decides on.
// Third slot is a sub-label, so the drawdown type does not crowd the number.
function statsOf(deal, labels) {
  const r = deal.rules;
  const out = [];
  if (r.profitTarget) out.push([labels.target, `$${usd(r.profitTarget)}`, '']);
  if (r.maxDrawdown) out.push([labels.maxdd, `$${usd(r.maxDrawdown)}`, r.ddType]);
  if (r.dailyLoss) out.push([labels.dailyloss, `$${usd(r.dailyLoss)}`, r.dailyLossSoft ? 'soft' : '']);
  return out;
}

export function renderEmail(deal, { generatedAt } = {}) {
  const h = deal.headline;
  const { messages, takes } = loadCopy();
  const values = valuesFor(deal, { takes });
  const labels = parseLabels(messages['email.labels']);

  // Values and template text both get escaped before they touch the markup, so
  // an apostrophe or an accent in the copy file cannot break the email.
  const hv = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, esc(v)]));
  const goldBold = (t) => `<strong style="color:${C.gold};">${t}</strong>`;
  const inkBold = (t) => `<strong style="color:${C.ink};">${t}</strong>`;
  const html_ = (block, bold = inkBold) => fill(esc(messages[block]), hv, { blockName: block, bold });

  const subject = subjectOf(messages, values);
  const preheader = say(messages, 'email.preheader', values);

  // The old price gets struck through wherever the copy chose to put it.
  const lead = html_('email.lead', goldBold);
  const leadHtml = hv.was
    ? lead.replace(hv.was, `<s style="color:${C.muted};">${hv.was}</s>`)
    : lead;

  const ladderRows = deal.ladder
    .map((p) => {
      const lead = p.size === h.size;
      return `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${C.borderSoft};font:${lead ? '700' : '500'} 15px ${FONT};color:${lead ? C.gold : C.muted};">${sizeLabel(p.size)}</td>
              <td style="padding:8px 0;border-bottom:1px solid ${C.borderSoft};font:700 15px ${FONT};color:${lead ? C.gold : C.ink};text-align:right;">${at(deal, p.price)}</td>
              <td style="padding:8px 0 8px 12px;border-bottom:1px solid ${C.borderSoft};font:400 14px ${FONT};color:${C.muted};text-align:right;">${p.originalPrice ? `<s>${at(deal, p.originalPrice)}</s>` : ''}</td>
            </tr>`;
    })
    .join('');

  const stats = statsOf(deal, labels);
  const statsBlock = stats.length
    ? `
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.raised};border:1px solid ${C.border};border-radius:12px;">
          <tr>${stats
            .map(
              ([label, value, sub]) => `
            <td style="padding:16px;font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};">${esc(label)}<br><span style="font:700 17px ${FONT};letter-spacing:0;text-transform:none;color:${C.ink};">${esc(value)}</span>${sub ? `<br><span style="font:400 10px ${MONO};letter-spacing:.12em;color:${C.muted};">${esc(sub)}</span>` : ''}</td>`
            )
            .join('')}
          </tr>
        </table>
      </td></tr>`
    : '';

  // A titled panel: used for the catch and, when Angelo wrote one, his take.
  const panel = (title, body, background) => `
      <tr><td style="padding:0 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};border-radius:12px;">
          <tr><td style="padding:16px 20px;font:500 14px/1.55 ${FONT};color:${C.ink};">
            <span style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.gold};">${title}</span><br>
            ${body}
          </td></tr>
        </table>
      </td></tr>`;

  // values.take already has its placeholders resolved, so it only needs
  // escaping and the *bold* pass.
  const takeBlock = values.take
    ? panel(
        html_('email.take_title'),
        esc(values.take).replace(/\*([^*]+)\*/g, (_, t) => inkBold(t)),
        C.raised
      )
    : '';

  const caveats = deal.caveats.length
    ? panel(html_('email.catch_title'), deal.caveats.map((c) => esc(c.text)).join('<br>'), C.terraSoft)
    : '';

  const code = deal.code
    ? `<p style="margin:16px 0 0;font:500 15px ${FONT};color:${C.muted};">${fill(esc(messages['email.code']), hv, { blockName: 'email.code', bold: inkBold }).replace(esc(deal.code), `<strong style="color:${C.gold};font:700 15px ${MONO};">${esc(deal.code)}</strong>`)}</p>`
    : deal.codeViaLink
      ? `<p style="margin:16px 0 0;font:500 15px ${FONT};color:${C.muted};">${html_('email.code_in_link')}</p>`
      : '';

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:12px;">
      <tr><td style="padding:32px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="48" style="padding-right:16px;vertical-align:top;">
            <img src="${esc(deal.logo)}" width="48" height="48" alt="${esc(deal.firmName)}" style="display:block;width:48px;height:48px;border:0;">
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0;font:400 10px ${MONO};letter-spacing:.2em;text-transform:uppercase;color:${C.muted};">${html_('email.eyebrow')}${values.ends ? ` ${SEP} <span style="color:${C.gold};">${html_('email.ends')}</span>` : ''}</p>
            <h1 style="margin:8px 0 0;font:italic 400 32px/1.1 ${DISPLAY};color:${C.ink};">${esc(deal.firmName)}<span style="color:${C.gold};">.</span></h1>
          </td>
        </tr></table>
        <p style="margin:16px 0 0;font:500 18px/1.5 ${FONT};color:${C.ink};">${leadHtml}</p>
        ${values.discount ? `<p style="margin:4px 0 0;font:500 15px/1.5 ${FONT};color:${C.muted};">${html_('email.sub')}</p>` : ''}
      </td></tr>
      ${statsBlock}
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};padding-bottom:8px;">${esc(labels.size_col)}</td>
            <td style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};padding-bottom:8px;text-align:right;">${esc(labels.now_col)}</td>
            <td style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};padding-bottom:8px;text-align:right;">${esc(labels.before_col)}</td>
          </tr>${ladderRows}
        </table>
      </td></tr>
      <tr><td style="padding:24px 32px 0;font:500 15px/1.6 ${FONT};color:${C.muted};">
        ${html_('email.specs')}
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <a href="${esc(deal.url)}" style="display:inline-block;background:${C.gold};color:${C.surface};font:700 16px ${FONT};text-decoration:none;padding:16px 32px;border-radius:999px;">${html_('email.cta')}</a>
        ${code}
      </td></tr>
      ${takeBlock}
      ${caveats}
      <tr><td style="padding:24px 32px 32px;font:400 13px/1.6 ${FONT};color:${C.muted};border-top:1px solid ${C.borderSoft};">
        ${html_('email.footer')}${generatedAt ? ` <span style="color:${C.borderSoft};">(sync ${esc(generatedAt)})</span>` : ''} <a href="{{unsubscribe_url}}" style="color:${C.muted};text-decoration:underline;">${html_('email.unsubscribe')}</a>.
      </td></tr>
    </table>
  </td></tr>
</table>`;

  const plain = (block) => say(messages, block, values);
  const text = [
    `${deal.firmName}, ${plain('email.eyebrow').toLowerCase()}`,
    '',
    `${plain('email.lead')} ${plain('email.sub')}${values.ends ? ` (${plain('email.ends')})` : ''}`.trim(),
    plain('email.specs'),
    statsOf(deal, labels).map(([label, value, sub]) => `${label}: ${value}${sub ? ` ${sub}` : ''}`).join(', '),
    '',
    deal.ladder.map((p) => `${sizeLabel(p.size)}: ${at(deal, p.price)}${p.originalPrice ? ` (was ${at(deal, p.originalPrice)})` : ''}`).join('\n'),
    '',
    ...(values.take ? [`${plain('email.take_title')}: ${values.take}`, ''] : []),
    ...(deal.caveats.length ? [`${plain('email.catch_title')}: ${deal.caveats.map((c) => c.text).join(' ')}`, ''] : []),
    codeLine(deal, messages, values),
    deal.url,
    '',
    plain('email.footer'),
    `${plain('email.unsubscribe')}: {{unsubscribe_url}}`,
  ]
    .filter((l) => l !== '')
    .join('\n')
    .replace(/\*/g, '');

  return { subject, preheader, html, text };
}
