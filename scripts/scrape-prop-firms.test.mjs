// Parsing tests for the price sync, run against real markup saved from the
// firms' own pages. No network, no browser.
// Run: node --test scripts/scrape-prop-firms.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { topOneActivationFees, legendsUpdatesFrom, legendsActivationFee } from './scrape-prop-firms.mjs';
import { fundedseatPlansFrom, FUNDEDSEAT_API_UNCOVERED } from './lib/fundedseat-api.mjs';

const fixture = (name) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

// Captured 2026-08-20 from https://toponefutures.com
const ELITE_ACCESS = fixture('top-one-elite-access.pane.html');
const ELITE_DAILY = fixture('top-one-elite-daily.pane.html');

test('Elite Access activation fees come off the page, one per size', () => {
  // The card reads "$139 $39 SAVE NOW ... Activation Fee $139": you pay $39 to
  // start and the activation fee once you pass.
  assert.deepEqual(topOneActivationFees(ELITE_ACCESS), [139, 189, 259, 359]);
});

test('Elite Daily says "None!", which means no fee, not an unknown one', () => {
  assert.deepEqual(topOneActivationFees(ELITE_DAILY), [null, null, null, null]);
});

test('the fee is read from the Activation Fee row, not from any nearby price', () => {
  // The 50K card is the proof: its struck price is $218 and its activation fee
  // is $189. A parser grabbing the wrong number would return 218 here.
  assert.equal(topOneActivationFees(ELITE_ACCESS)[1], 189);
  assert.ok(ELITE_ACCESS.includes('v3-price-old">$218'), 'fixture no longer has the $218 card');
});

test('a fee that is not a number is a failure, not a silent zero', () => {
  const broken = ELITE_ACCESS.replace(
    'v3-table-row-value"><div>$139</div>',
    'v3-table-row-value"><div>ask support</div>'
  );
  assert.throws(() => topOneActivationFees(broken), /unreadable activation fee: "ask support"/);
});

test('an absurd fee is refused, so a markup change cannot publish nonsense', () => {
  const broken = ELITE_ACCESS.replace(
    'v3-table-row-value"><div>$139</div>',
    'v3-table-row-value"><div>$99999</div>'
  );
  assert.throws(() => topOneActivationFees(broken), /unreadable activation fee/);
});

test('no Activation Fee row at all returns nothing, which the caller rejects', () => {
  // scrapeTopOne compares this length against the card count and throws, which
  // marks the firm stale instead of wiping the fees.
  assert.deepEqual(topOneActivationFees('<div>no table here</div>'), []);
});

test('what the parser reads matches what the published JSON says', () => {
  const data = JSON.parse(readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'));
  const access = data.firms
    .find((f) => f.id === 'top-one-futures')
    .programs.find((p) => p.name === 'Elite Access');
  const published = access.plans
    .slice()
    .sort((a, b) => a.size - b.size)
    .map((p) => p.activationFee ?? null);
  assert.deepEqual(published, topOneActivationFees(ELITE_ACCESS));
});

// ── LEGENDS Trading, read from their own shop API ───────────────────────────
// Captured 2026-08-20 from
// api.thelegendstrading.com/shop/plans?purchasableOnly=true&broker=Tradovate

const LEGENDS = JSON.parse(fixture('legends-shop-plans.json'));

test('their API field names are inverted, and we read the price the buyer pays', () => {
  // The card renders "$59 $29.50": price is the struck one, strikeThroughPrice
  // is what you pay. Getting this backwards would advertise double.
  const apprentice50 = legendsUpdatesFrom(LEGENDS).find(
    (u) => u.programName === 'Apprentice' && u.size === 50000
  );
  assert.equal(apprentice50.price, 29.5);
  assert.equal(apprentice50.originalPrice, 59);
  assert.equal(apprentice50.activationFee, 99);
});

test('only what they actually sell comes back, seven plans over two programs', () => {
  const updates = legendsUpdatesFrom(LEGENDS);
  assert.equal(updates.length, 7);
  assert.deepEqual([...new Set(updates.map((u) => u.programName))].sort(), ['Apprentice', 'Elite']);
  // Elite pays nothing on activation, which is why it beats Apprentice on the
  // cost to get funded even at a smaller headline percentage.
  for (const u of updates.filter((x) => x.programName === 'Elite')) {
    assert.equal(u.activationFee, null, `Elite ${u.size} should have no activation fee`);
  }
});

test('a swap of those two fields is caught, not published', () => {
  const broken = structuredClone(LEGENDS);
  const plan = broken.data.find((p) => p.productCategory === 'Apprentice');
  [plan.price, plan.strikeThroughPrice] = [plan.strikeThroughPrice, plan.price];
  assert.throws(() => legendsUpdatesFrom(broken), /may have been swapped back/);
});

test('the activation fee is read from their wording, both shapes', () => {
  assert.equal(legendsActivationFee('Code: LTG\n$99 Activation Fee'), 99);
  assert.equal(legendsActivationFee('Activation Fee: None'), null);
  assert.equal(legendsActivationFee(''), null);
  assert.throws(() => legendsActivationFee('$99999 Activation Fee'), /unreadable/);
});

test('an empty API answer is a failure, never an empty price list', () => {
  assert.throws(() => legendsUpdatesFrom({ data: [] }), /returned no plans/);
  assert.throws(() => legendsUpdatesFrom({}), /returned no plans/);
});

/* ---------------- FundedSeat: their own /api/pullchallenges ---------------- */

// Captured 2026-08-20 from https://fundedseat.com/api/pullchallenges (24 rows).
const FS_API = JSON.parse(fixture('fundedseat-pullchallenges.json'));
const fsPlan = (plans, programName, size) => plans.find((p) => p.programName === programName && p.size === size);

test('their 24 products resolve to the 11 plans we list, Flex aside', () => {
  const plans = fundedseatPlansFrom(FS_API);
  assert.equal(plans.length, 11);
  assert.deepEqual(
    [...new Set(plans.map((p) => p.programName))].sort(),
    ['Daily', 'Instant Funding', 'Sprint'],
  );
  assert.deepEqual(FUNDEDSEAT_API_UNCOVERED, ['Flex']);
  assert.equal(plans.some((p) => p.programName === 'Flex'), false);
});

test('the price is the one their page sells, not the Ultra product of the same size', () => {
  const plans = fundedseatPlansFrom(FS_API);
  assert.equal(fsPlan(plans, 'Daily', 50000).price, 104.95);
  assert.equal(fsPlan(plans, 'Daily', 50000).originalPrice, 190);
  // The 50K "Ultra" rows sell at $179.95, $279.95 and $229.95: three prices a
  // substring read on "Daily" could have published instead of $104.95.
  const ultra50 = FS_API.filter((r) => /^1 Step Daily Ultra \(\d+%\) - 50K$/.test(r.name)).map((r) => r.price);
  assert.deepEqual(ultra50.sort((a, b) => a - b), [179.95, 229.95, 279.95]);
  for (const price of ultra50) assert.equal(plans.some((p) => p.price === price), false);
});

test('their own catalogue repeats a name at three prices, so guessing is refused', () => {
  // "1 Step Daily Ultra (35%) - 100K" is active three times: $239.95, $269.95,
  // $409.95. Nothing tells an outsider which one the page sells — which is why
  // a duplicate on a name we DO map has to stop the sync.
  const dup = FS_API.filter((r) => r.name === '1 Step Daily Ultra (35%) - 100K' && r.active);
  assert.deepEqual(dup.map((r) => r.price).sort((a, b) => a - b), [239.95, 269.95, 409.95]);
});

test('"Bolt" is a different product, trailing space in their name included', () => {
  const plans = fundedseatPlansFrom(FS_API);
  assert.equal(fsPlan(plans, 'Instant Funding', 100000).price, 494.95);
  assert.ok(FS_API.some((r) => r.name === 'Instant Funding Bolt - 100K ' && r.price === 439.95));
  assert.equal(plans.some((p) => p.price === 439.95), false);
});

test('the daily loss is the challenge limit, not the funded one', () => {
  // Their root `dailyloss` on Sprint 50K is 1000 (what a funded account gets);
  // the challenge runs on 1200. Publishing the root value understates the risk.
  const row = FS_API.find((r) => r.name === '1 Step Sprint - 50K');
  assert.equal(row.dailyloss, 1000);
  assert.equal(fsPlan(fundedseatPlansFrom(FS_API), 'Sprint', 50000).rules.dailyLoss, 1200);
});

test('a rule the API leaves null is no claim at all, not a claimed absence', () => {
  const plans = fundedseatPlansFrom(FS_API);
  // Instant Funding has a 15%-biggest-trade rule their API does not encode, and
  // no profit target: both must stay unclaimed so nothing overwrites our JSON.
  const instant = fsPlan(plans, 'Instant Funding', 50000);
  assert.equal('consistency' in instant.rules, false);
  assert.equal('profitTarget' in instant.rules, false);
  // Daily does carry both, and they are read.
  const daily = fsPlan(plans, 'Daily', 50000);
  assert.equal(daily.rules.consistency, '35%');
  assert.equal(daily.rules.profitTarget, 3000);
  assert.equal(daily.rules.maxDrawdown, 2000);
  assert.deepEqual(daily.rules.contracts, { minis: 4, micros: null });
});

test('the consistency their card hides is reported, never published', () => {
  const plans = fundedseatPlansFrom(FS_API);
  // Sprint cards read "Consistency: None"; every Sprint funded step says 25%.
  assert.equal(fsPlan(plans, 'Sprint', 50000).payoutConsistency, '25%');
  assert.equal('consistency' in fsPlan(plans, 'Sprint', 50000).rules, false);
  assert.equal(fsPlan(plans, 'Daily', 50000).payoutConsistency, null);
});

test('a renamed family stops the sync instead of keeping stale prices', () => {
  const renamed = FS_API.map((r) =>
    r.name.startsWith('1 Step Sprint') ? { ...r, name: r.name.replace('Sprint', 'Sprint V2') } : r,
  );
  assert.throws(() => fundedseatPlansFrom(renamed), /product naming changed/);
});

test('two active rows under one name is a refusal, not a coin flip', () => {
  const row = FS_API.find((r) => r.name === '1 Step Daily (35%) - 50K');
  assert.throws(() => fundedseatPlansFrom([...FS_API, { ...row, id: 99999, price: 1 }]), /refusing to guess/);
});

test('a deactivated product is not sold, so it is not read', () => {
  const off = FS_API.map((r) => (r.name === '1 Step Daily (35%) - 150K' ? { ...r, active: false } : r));
  const plans = fundedseatPlansFrom(off);
  assert.equal(plans.length, 10);
  assert.equal(fsPlan(plans, 'Daily', 150000), undefined);
});

test('an empty API answer is a failure, never zero plans', () => {
  assert.throws(() => fundedseatPlansFrom([]), /non-empty array/);
  assert.throws(() => fundedseatPlansFrom(null), /non-empty array/);
});

test('what the API says matches the published JSON, field by field', () => {
  const firm = JSON.parse(readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'))
    .firms.find((f) => f.id === 'fundedseat');
  const plans = fundedseatPlansFrom(FS_API);
  let checked = 0;
  for (const program of firm.programs) {
    for (const plan of program.plans) {
      const api = fsPlan(plans, program.name, plan.size);
      if (!api) continue; // Flex: not sold through this endpoint
      const tag = `${program.name} ${plan.size}`;
      assert.equal(plan.price, api.price, `${tag} price`);
      assert.equal(plan.originalPrice, api.originalPrice, `${tag} originalPrice`);
      for (const [field, v] of Object.entries(api.rules)) {
        if (field === 'contracts') {
          assert.equal(plan.contracts.startsWith(`${v.minis} mini`), true, `${tag} contracts`);
        } else if (field === 'dailyLoss' || field === 'consistency') {
          assert.equal(String(plan[field]), String(v), `${tag} ${field}`);
        } else {
          assert.equal(plan[field], v, `${tag} ${field}`);
        }
      }
      checked++;
    }
  }
  assert.equal(checked, 11);
});
