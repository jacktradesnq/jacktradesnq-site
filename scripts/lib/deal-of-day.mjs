// Daily prop-firm deal engine.
//
// Every figure it prints is read from public/data/prop-firms.json (scraped by
// scripts/scrape-prop-firms.mjs). Nothing here invents a price, a rule or a
// discount: if the data does not carry it, the copy does not mention it.
//
// Pure functions only, no fs and no network, so the whole thing is testable:
// see scripts/deal-of-day.test.mjs.

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

// The headline plan is the deepest discount of the firm. When several sizes
// share that discount, lead with the 50K account (the one traders compare) and
// then with the cheaper price, so the hook is relatable instead of just big.
function headlineOf(firm) {
  let best = null;
  for (const program of firm.programs ?? []) {
    for (const plan of program.plans ?? []) {
      const pct = discountPct(plan.price, plan.originalPrice);
      const distance = Math.abs(plan.size - REFERENCE_SIZE);
      const cand = { program, plan, pct, distance };
      if (
        !best ||
        cand.pct > best.pct ||
        (cand.pct === best.pct &&
          (cand.distance < best.distance ||
            (cand.distance === best.distance && cand.plan.price < best.plan.price)))
      ) {
        best = cand;
      }
    }
  }
  if (!best) return null;

  // No struck-through price anywhere: the firm still has an affiliate discount
  // (codeDiscountPct) or a flat price. Lead with the cheapest entry instead.
  if (best.pct === 0) {
    let cheapest = null;
    for (const program of firm.programs ?? []) {
      for (const plan of program.plans ?? []) {
        if (!cheapest || plan.price < cheapest.plan.price) cheapest = { program, plan };
      }
    }
    if (!cheapest) return null;
    return {
      program: cheapest.program,
      plan: cheapest.plan,
      pct: firm.codeDiscountPct ?? 0,
      pctSource: firm.codeDiscountPct ? 'firm.codeDiscountPct' : null,
    };
  }
  return { program: best.program, plan: best.plan, pct: best.pct, pctSource: 'plan.originalPrice' };
}

function caveatsOf(program, plan) {
  const out = [];
  if (program.priceType === 'monthly') {
    out.push({
      text: 'Billed every month, not once. It stops costing you the day you stop.',
      source: 'program.priceType',
    });
  }
  if (plan.ddType && plan.ddType !== 'EOD') {
    out.push({
      text: `Drawdown trails your balance (${plan.ddType}), so it is tighter than the headline number.`,
      source: 'plan.ddType',
    });
  }
  if (plan.consistency && !/^(none|no|n\/a)$/i.test(String(plan.consistency).trim())) {
    out.push({ text: `Consistency rule: ${plan.consistency}.`, source: 'plan.consistency' });
  }
  if (plan.activationFee) {
    out.push({
      text: `${money(plan.activationFee)} activation fee once you get funded.`,
      source: 'plan.activationFee',
    });
  }
  return out.slice(0, 2);
}

function candidateFor(firm, { today, prevSnapshot }) {
  if (firm.stale) return null; // scrape failed, old numbers kept: never headline it
  const head = headlineOf(firm);
  if (!head) return null;

  const { program, plan } = head;
  const promo = program.promoCode
    ? { label: program.promoLabel ?? null, code: program.promoCode, ends: undefined }
    : firm.promo ?? null;

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

  const ladder = (program.plans ?? [])
    .slice()
    .sort((a, b) => a.size - b.size)
    .map((p) => ({ size: p.size, price: p.price, originalPrice: p.originalPrice }));

  return {
    firmId: firm.id,
    firmName: firm.name,
    url: firm.url,
    code: program.promoCode ?? firm.promo?.code ?? firm.code ?? null,
    codeInLink: /(?:coupon|code|ref|afmc|a_aid)=/i.test(firm.url),
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
      price: plan.price,
      originalPrice: plan.originalPrice,
      discountPct: head.pct,
      discountSource: head.pctSource,
      priceType: program.priceType,
    },
    rules: {
      profitTarget: plan.profitTarget,
      maxDrawdown: plan.maxDrawdown,
      ddType: plan.ddType,
      dailyLoss: plan.dailyLoss,
      contracts: plan.contracts,
    },
    ladder,
    caveats: caveatsOf(program, plan),
    signals,
    score,
  };
}

export function analyzeFirms(data, { today, prevSnapshot = null } = {}) {
  return data.firms
    .map((f) => candidateFor(f, { today, prevSnapshot }))
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

function codeLine(deal) {
  if (deal.code) return `Code ${deal.code}`;
  if (deal.codeInLink) return 'Discount is already on the link';
  return '';
}

export function renderTweet(deal) {
  const h = deal.headline;
  const l1 = `${deal.firmName} ${deal.programLabel} ${sizeLabel(h.size)} is ${priceLine(deal)}.${endsClause(deal)}`;
  const l2 = `${deal.split} split, payout ${prose(deal.payout)}.`;
  const code = codeLine(deal);
  const l3 = code ? `${code}: ${deal.url}` : deal.url;
  return [l1, l2, l3].join('\n');
}

export function renderDiscord(deal) {
  const h = deal.headline;
  const ladder = deal.ladder.map((p) => `${sizeLabel(p.size)} ${at(deal, p.price)}`).join(' · ');
  const lines = [
    `**Deal of the day: ${deal.firmName}**`,
    `${deal.programLabel} ${sizeLabel(h.size)} at ${priceLine(deal)}${h.discountPct ? ` (${h.discountPct}% off)` : ''}.${endsClause(deal)}`,
    '',
    `Whole ladder: ${ladder}`,
    `${deal.split} split · payout ${deal.payout} · ${deal.rules.ddType} drawdown${deal.rules.contracts ? ` · ${deal.rules.contracts}` : ''}`,
  ];
  if (deal.caveats.length) lines.push(`Watch out: ${deal.caveats.map((c) => c.text).join(' ')}`);
  const code = codeLine(deal);
  lines.push('', code ? `${code} · <${deal.url}>` : `<${deal.url}>`);
  lines.push(`Prices checked ${deal.lastChecked} on the firm's own site.`);
  return lines.join('\n');
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

function subjectOf(deal) {
  const h = deal.headline;
  let s = `${deal.firmName}: ${sizeLabel(h.size)} ${deal.programLabel} at ${at(deal, h.price)}`;
  if (deal.signals.includes('expiring')) s += `, ends ${weekdayOf(deal.endsAt)}`;
  if (s.length > 70) s = `${deal.firmName}: ${sizeLabel(h.size)} at ${at(deal, h.price)}`;
  return s.slice(0, 70);
}

// Target, drawdown and daily loss are what a trader actually decides on.
function statsOf(deal) {
  const r = deal.rules;
  const out = [];
  if (r.profitTarget) out.push(['Profit target', `$${usd(r.profitTarget)}`]);
  if (r.maxDrawdown) out.push(['Max drawdown', `$${usd(r.maxDrawdown)} ${r.ddType}`]);
  if (r.dailyLoss) out.push(['Daily loss', `$${usd(r.dailyLoss)}`]);
  return out;
}

export function renderEmail(deal, { generatedAt } = {}) {
  const h = deal.headline;
  const subject = subjectOf(deal);
  const preheader = h.originalPrice
    ? `${h.discountPct}% off, was ${money(h.originalPrice)}. ${deal.split} split, payout ${deal.payout}.`
    : `${deal.split} split, payout ${deal.payout}. Prices checked ${deal.lastChecked}.`;

  const ladderRows = deal.ladder
    .map((p) => {
      const lead = p.size === h.size;
      return `
            <tr>
              <td style="padding:9px 0;border-bottom:1px solid ${C.borderSoft};font:${lead ? '700' : '500'} 15px ${FONT};color:${lead ? C.gold : C.muted};">${sizeLabel(p.size)}</td>
              <td style="padding:9px 0;border-bottom:1px solid ${C.borderSoft};font:700 15px ${FONT};color:${lead ? C.gold : C.ink};text-align:right;">${at(deal, p.price)}</td>
              <td style="padding:9px 0 9px 12px;border-bottom:1px solid ${C.borderSoft};font:400 14px ${FONT};color:${C.muted};text-align:right;">${p.originalPrice ? `<s>${at(deal, p.originalPrice)}</s>` : ''}</td>
            </tr>`;
    })
    .join('');

  const stats = statsOf(deal);
  const statsBlock = stats.length
    ? `
      <tr><td style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.raised};border:1px solid ${C.border};border-radius:12px;">
          <tr>${stats
            .map(
              ([label, value]) => `
            <td style="padding:14px 16px;font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};">${esc(label)}<br><span style="font:700 15px ${FONT};letter-spacing:0;text-transform:none;color:${C.ink};">${esc(value)}</span></td>`
            )
            .join('')}
          </tr>
        </table>
      </td></tr>`
    : '';

  const caveats = deal.caveats.length
    ? `
      <tr><td style="padding:0 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.terraSoft};border-radius:12px;">
          <tr><td style="padding:16px 20px;font:500 14px/1.55 ${FONT};color:${C.ink};">
            <span style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.gold};">The catch</span><br>
            ${deal.caveats.map((c) => esc(c.text)).join('<br>')}
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const code = deal.code
    ? `<p style="margin:18px 0 0;font:500 15px ${FONT};color:${C.muted};">Code at checkout: <strong style="color:${C.gold};font:700 15px ${MONO};">${esc(deal.code)}</strong></p>`
    : deal.codeInLink
      ? `<p style="margin:18px 0 0;font:500 15px ${FONT};color:${C.muted};">No code to type, the discount rides on the link.</p>`
      : '';

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.border};border-radius:12px;">
      <tr><td style="padding:28px 32px 0;">
        <p style="margin:0;font:400 10px ${MONO};letter-spacing:.2em;text-transform:uppercase;color:${C.muted};">Deal of the day${deal.signals.includes('expiring') ? ` ${SEP} <span style="color:${C.gold};">ends ${weekdayOf(deal.endsAt)}</span>` : ''}</p>
        <h1 style="margin:10px 0 0;font:italic 400 34px/1.1 ${DISPLAY};color:${C.ink};">${esc(deal.firmName)}<span style="color:${C.gold};">.</span></h1>
        <p style="margin:12px 0 0;font:500 17px/1.5 ${FONT};color:${C.muted};">${esc(deal.programLabel)} ${sizeLabel(h.size)} is <strong style="color:${C.gold};">${at(deal, h.price)}</strong>${h.originalPrice ? ` instead of <s>${at(deal, h.originalPrice)}</s>, ${h.discountPct}% off` : ''}.</p>
      </td></tr>
      ${statsBlock}
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};padding-bottom:6px;">Account size</td>
            <td style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};padding-bottom:6px;text-align:right;">Now</td>
            <td style="font:400 10px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${C.muted};padding-bottom:6px;text-align:right;">Before</td>
          </tr>${ladderRows}
        </table>
      </td></tr>
      <tr><td style="padding:22px 32px 0;font:500 15px/1.6 ${FONT};color:${C.muted};">
        <strong style="color:${C.ink};">${esc(deal.split)}</strong> profit split ${SEP} payout <strong style="color:${C.ink};">${esc(deal.payout)}</strong> ${SEP} ${esc(deal.rules.ddType)} drawdown${deal.rules.contracts ? ` ${SEP} ${esc(deal.rules.contracts)}` : ''}
      </td></tr>
      <tr><td style="padding:26px 32px;">
        <a href="${esc(deal.url)}" style="display:inline-block;background:${C.gold};color:${C.surface};font:700 16px ${FONT};text-decoration:none;padding:14px 30px;border-radius:999px;">See the offer</a>
        ${code}
      </td></tr>
      ${caveats}
      <tr><td style="padding:20px 32px 28px;font:400 13px/1.6 ${FONT};color:${C.muted};border-top:1px solid ${C.borderSoft};">
        Every price above is read straight off ${esc(deal.firmName)}'s own site, last checked ${esc(deal.lastChecked)}${generatedAt ? ` (data synced ${esc(generatedAt)})` : ''}. Links are affiliate links: the price you pay does not change.<br><br>
        You are getting this because you signed up for the daily prop firm deal on jacktradesnq.com. <a href="{{unsubscribe_url}}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>.
      </td></tr>
    </table>
  </td></tr>
</table>`;

  const text = [
    `${deal.firmName} - deal of the day`,
    '',
    `${deal.programLabel} ${sizeLabel(h.size)} is ${priceLine(deal)}${h.discountPct ? ` (${h.discountPct}% off)` : ''}.${endsClause(deal)}`,
    `${deal.split} split, payout ${prose(deal.payout)}, ${deal.rules.ddType} drawdown.`,
    statsOf(deal).map(([label, value]) => `${label}: ${value}`).join(', '),
    '',
    deal.ladder.map((p) => `${sizeLabel(p.size)}: ${at(deal, p.price)}${p.originalPrice ? ` (was ${at(deal, p.originalPrice)})` : ''}`).join('\n'),
    '',
    ...(deal.caveats.length ? [`The catch: ${deal.caveats.map((c) => c.text).join(' ')}`, ''] : []),
    codeLine(deal) ? `${codeLine(deal)}` : '',
    deal.url,
    '',
    `Prices checked ${deal.lastChecked} on the firm's own site. Affiliate links, your price does not change.`,
    'Unsubscribe: {{unsubscribe_url}}',
  ]
    .filter((l) => l !== '')
    .join('\n');

  return { subject, preheader, html, text };
}
