// Reads public/data/prop-firms.json and works out, per firm, the promo worth
// showing: reference size first, his code and never a public one, and a
// discount only when the arithmetic on one plan's two prices supports it.
// Used by scripts/build-live-promos.mjs (feed of /go/promos/*).

import { readFileSync } from 'node:fs';

import { parseCodes } from '../../lib/firm-codes.mjs';

const URGENCY_WINDOW_H = 96; // a promo ending inside 4 days is flagged "expiring"
const REFERENCE_SIZE = 50000;
const AFFILIATE_CODE = 'JTNQ';

const dayStart = (iso) => Date.parse(`${iso}T00:00:00Z`);
const dayEnd = (iso) => Date.parse(`${iso}T23:59:59Z`);

function programLabelOf(firmName, programName) {
  const first = firmName.split(/\s+/)[0];
  const re = new RegExp(`^${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
  const stripped = programName.replace(re, '').trim();
  return stripped || programName;
}

// The size traders actually compare against each other.
function discountPct(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round((1 - price / originalPrice) * 100);
}

// ── change detection ─────────────────────────────────────────────────────────

// A snapshot is what yesterday's run saw: promo identity + every plan price.
// Diffing two snapshots is how "new promo" and "price drop" are detected
// without re-scraping anything.
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
  // A percentage hides the fee that comes after. A plan 80% off at $37/mo that
  // charges $99 once you pass costs $136 minimum, while a 35% off plan at $96.85
  // with nothing after is the cheaper path.
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
    // off the listed price, so the promo feed and the page never disagree.
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

// content/prop-firms/codes.md: parsed by lib/firm-codes.mjs, shared with the /prop-firms page.
export { parseCodes };

export function loadCodes() {
  return parseCodes(readFileSync(new URL('../../content/prop-firms/codes.md', import.meta.url), 'utf8'));
}

function codeFor(firm, codes) {
  const declared = codes?.[firm.id];
  if (!declared) return { code: AFFILIATE_CODE, viaLink: false };
  if (declared.toLowerCase() === 'link') return { code: null, viaLink: true };
  return { code: declared, viaLink: false };
}

function candidateFor(firm, { today, codes }) {
  if (firm.stale) return null; // scrape failed, old numbers kept: never show it
  const head = headlineOf(firm);
  if (!head) return null;

  const { program, plan } = head;
  const promo = program.promoCode ? { ends: undefined } : firm.promo ?? null;
  const ourCode = codeFor(firm, codes);

  const endsAt = promo?.ends ?? null;
  const hoursLeft = endsAt ? Math.round((dayEnd(endsAt) - dayStart(today)) / 3.6e6) : null;
  const expiring = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= URGENCY_WINDOW_H;

  return {
    firmId: firm.id,
    firmName: firm.name,
    url: firm.url,
    code: ourCode.code,
    codeViaLink: ourCode.viaLink,
    split: firm.split,
    payout: firm.payout,
    lastChecked: firm.lastChecked,
    programName: program.name,
    programLabel: programLabelOf(firm.name, program.name),
    programType: program.type,
    priceType: program.priceType,
    endsAt,
    hoursLeft,
    expiring,
    headline: {
      size: plan.size,
      price: head.priceOverride ?? plan.price,
      originalPrice: head.wasOverride ?? plan.originalPrice,
      discountPct: head.pct,
      discountSource: head.pctSource,
    },
    rules: {
      profitTarget: plan.profitTarget,
      maxDrawdown: plan.maxDrawdown,
      ddType: plan.ddType,
      dailyLoss: plan.dailyLoss,
      contracts: plan.contracts,
      consistency: plan.consistency ?? null,
      activationFee: plan.activationFee ?? null,
    },
    priceNote: plan.priceNote ?? null,
    note: plan.note ?? null, // ce que la firme affiche et qui qualifie ce prix
  };
}

export function analyzeFirms(data, { today, codes = loadCodes() } = {}) {
  return data.firms
    .map((f) => candidateFor(f, { today, codes }))
    .filter(Boolean)
    .sort((a, b) => a.firmId.localeCompare(b.firmId));
}
