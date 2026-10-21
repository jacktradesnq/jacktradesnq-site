// Tests for the promo analysis behind public/data/live-promos.json.
// Run: node --test scripts/promo-analysis.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { analyzeFirms, parseCodes, loadCodes } from './lib/promo-analysis.mjs';

// Frozen data on purpose: the published file is rewritten every morning by the
// price sync, and these tests are about the arithmetic, not today's prices.
const DATA = JSON.parse(readFileSync(new URL('./fixtures/prop-firms.fixture.json', import.meta.url), 'utf8'));

// One firm's candidate, whatever the rest of the day looks like.
function pickDeal(data, { today, forceFirmId = null }) {
  const candidates = analyzeFirms(data, { today });
  return forceFirmId ? (candidates.find((c) => c.firmId === forceFirmId) ?? null) : candidates[0] ?? null;
}

test('an activation fee beats a headline percentage', () => {
  // A $39 headline plus a $189 activation is $228 to get funded, more than a
  // $98 plan with nothing after. The cheaper path wins even though it shows a
  // smaller percentage. Injected on a kept firm so the test pins the engine,
  // not a partnership that no longer exists.
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'e8-markets');
  firm.stale = false;
  const base = firm.programs[0].plans.find((pl) => pl.size === 50000);
  firm.programs = [
    {
      name: 'Headline Cheap',
      type: 'eval',
      priceType: 'one-time',
      plans: [{ ...base, price: 39, originalPrice: 218, activationFee: 189 }],
    },
    {
      name: 'All In',
      type: 'eval',
      priceType: 'one-time',
      plans: [{ ...base, price: 98, originalPrice: 218, activationFee: null }],
    },
  ];
  const deal = pickDeal(data, { today: '2026-09-30', forceFirmId: 'e8-markets' });
  assert.equal(deal.programLabel, 'All In');
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.headline.price, 98);
  assert.equal(deal.rules.activationFee, null);
});

test('the cheapest path to funded is what gets picked, fees included', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', forceFirmId: firm.id });
    if (!deal) continue;
    const size = deal.headline.size;
    // Same effective price the engine uses: a firm with codeDiscountPct and no
    // struck price is discounted by the code (Traders Launch, -15%).
    const effective = (pl) =>
      firm.codeDiscountPct != null && pl.originalPrice == null
        ? Math.round(pl.price * (1 - firm.codeDiscountPct / 100) * 100) / 100
        : pl.price;
    const cheapest = Math.min(
      ...firm.programs.flatMap((p) =>
        p.plans.filter((pl) => pl.size === size).map((pl) => effective(pl) + (pl.activationFee ?? 0))
      )
    );
    const picked = deal.headline.price + (deal.rules.activationFee ?? 0);
    assert.equal(picked, cheapest, `${firm.id}: picked ${picked}, cheapest at that size is ${cheapest}`);
  }
});

test('the reference size wins over a bigger percentage elsewhere', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', forceFirmId: firm.id });
    if (!deal) continue;
    const sizes = new Set(firm.programs.flatMap((p) => p.plans.map((pl) => pl.size)));
    const expected = sizes.has(50000)
      ? 50000
      : [...sizes].reduce((a, b) => (Math.abs(b - 50000) < Math.abs(a - 50000) ? b : a));
    assert.equal(deal.headline.size, expected, `${firm.id} headlined ${deal.headline.size}`);
  }
});

test('a stale firm is never headlined (its promo may already be dead)', () => {
  const data = structuredClone(DATA);
  for (const f of data.firms) f.stale = f.id === 'e8-markets';
  const deal = pickDeal(data, { today: '2026-09-30', history: [] });
  assert.notEqual(deal.firmId, 'e8-markets');
});

test('every figure in a candidate comes from the JSON, never computed prose', () => {
  const cands = analyzeFirms(DATA, { today: '2026-08-20' });
  for (const c of cands) {
    const firm = DATA.firms.find((f) => f.id === c.firmId);
    const program = firm.programs.find((p) => p.name === c.programName);
    assert.ok(program, `${c.firmId}: program ${c.programName} not in data`);
    const plan = program.plans.find((p) => p.size === c.headline.size);
    assert.ok(plan, `${c.firmId}: size ${c.headline.size} not in ${c.programName}`);

    if (c.headline.discountSource === 'firm.codeDiscountPct') {
      // Same rule as the comparison page: the affiliate code comes off the
      // listed price, which becomes the struck-through one.
      assert.equal(c.headline.price, Math.round(plan.price * (1 - firm.codeDiscountPct / 100) * 100) / 100);
      assert.equal(c.headline.originalPrice, plan.price);
    } else {
      assert.equal(c.headline.price, plan.price);
      assert.equal(c.headline.originalPrice, plan.originalPrice);
    }
  }
});

test('the plan with no activation fee wins when it is cheaper all in', () => {
  // A monthly 80% off at $37 plus a $99 fee is $136 to get funded. A one-time
  // 35% off at $96.85 with nothing after is the cheaper path. Same arbitration
  // as the headline-percentage test, on a kept firm.
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'e8-markets');
  const base = firm.programs[0].plans.find((pl) => pl.size === 50000);
  firm.programs = [
    {
      name: 'Apprentice Path',
      type: 'eval',
      priceType: 'monthly',
      plans: [{ ...base, price: 37, originalPrice: 185, activationFee: 99 }],
    },
    {
      name: 'Elite Path',
      type: 'eval',
      priceType: 'one-time',
      plans: [{ ...base, price: 96.85, originalPrice: 149, activationFee: null }],
    },
  ];
  const deal = pickDeal(data, { today: '2026-08-20', forceFirmId: 'e8-markets' });
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.programLabel, 'Elite Path');
  assert.equal(deal.rules.activationFee, null);
  assert.equal(deal.priceType, 'one-time');
  assert.equal(deal.headline.price, 96.85);
});

test('the program label never repeats the firm name', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', forceFirmId: firm.id });
    if (!deal) continue;
    const first = deal.firmName.split(/\s+/)[0].toLowerCase();
    assert.ok(
      !deal.programLabel.toLowerCase().startsWith(first),
      `${firm.id}: "${deal.firmName} ${deal.programLabel}" stutters`
    );
  }
});

test('a firm whose promo expires is flagged, the others are not', () => {
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'e8-markets');
  firm.promo = { ...firm.promo, ends: '2026-08-23' };
  const e8 = pickDeal(data, { today: '2026-08-20', forceFirmId: 'e8-markets' });
  assert.equal(e8.expiring, true);
  assert.ok(e8.hoursLeft > 0 && e8.hoursLeft <= 96, `hoursLeft=${e8.hoursLeft}`);
  const far = structuredClone(DATA);
  far.firms.find((f) => f.id === 'e8-markets').promo = { ...firm.promo, ends: '2026-12-31' };
  assert.equal(pickDeal(far, { today: '2026-08-20', forceFirmId: 'e8-markets' }).expiring, false);
});

test('a firm priced by affiliate code shows the same price as the site', () => {
  // Traders Launch has no struck price in the data, it has codeDiscountPct 20,
  // and app/prop-firms/page.tsx renders $127.20 instead of $159 for the 100K.
  const deal = pickDeal(DATA, { today: '2026-08-20', forceFirmId: 'traders-launch' });
  assert.equal(deal.headline.size, 100000);
  assert.equal(deal.headline.price, 127.2);
  assert.equal(deal.headline.originalPrice, 159);
  assert.equal(deal.headline.discountPct, 20);
});

test('the logo of every firm exists on disk', () => {
  for (const firm of DATA.firms) {
    assert.ok(
      existsSync(new URL(`../public/logos/email/${firm.id}.png`, import.meta.url)),
      `${firm.id}: public/logos/email/${firm.id}.png missing`
    );
  }
});

// ── codes ────────────────────────────────────────────────────────────────────

test('only the "## codes" block of codes.md is read', () => {
  const codes = parseCodes('# Notes\n\n    a = JTNQ\n\n## codes\ne8-markets = JTNQ\ntraders-launch = link\n\n---\n\nx = y\n');
  assert.deepEqual(codes, { 'e8-markets': 'JTNQ', 'traders-launch': 'link' }); // parser only: sample text, not the live file
});

test('every firm prints JTNQ, except a firm declared « link » in codes.md', () => {
  const codes = loadCodes();
  for (const c of analyzeFirms(DATA, { today: '2026-08-20' })) {
    if (codes[c.firmId]?.toLowerCase() === 'link') {
      assert.equal(c.code, null);
      assert.equal(c.codeViaLink, true);
    } else {
      assert.equal(c.code, 'JTNQ', c.firmId);
      assert.equal(c.codeViaLink, false);
    }
  }
});

test('an undeclared firm falls back to JTNQ', () => {
  const deal = analyzeFirms(DATA, { today: '2026-08-20', codes: {} })[0];
  assert.equal(deal.code, 'JTNQ');
});
