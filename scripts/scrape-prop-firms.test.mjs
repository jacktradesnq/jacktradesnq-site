// Parsing tests for the price sync, run against real markup saved from the
// firms' own pages. No network, no browser.
// Run: node --test scripts/scrape-prop-firms.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fundedseatPlansFrom, FUNDEDSEAT_API_UNCOVERED } from './lib/fundedseat-api.mjs';

const fixture = (name) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

/* ---------------- FundedSeat: their own /api/pullchallenges ---------------- */

// scripts/lib/fundedseat-api.mjs ne fait plus la tournee de prix (c'est
// scripts/lib/firms/fundedseat.mjs, teste dans scripts/firms-fundedseat.test.mjs)
// mais scripts/check-rule-drift.mjs le lit toujours : son mapping par nom exact
// reste teste ici.
// Captured 2026-08-20 from https://fundedseat.com/api/pullchallenges (24 rows).
const FS_API = JSON.parse(fixture('fundedseat-pullchallenges.json'));
const fsPlan = (plans, programName, size) => plans.find((p) => p.programName === programName && p.size === size);

test('their 24 products resolve to the 11 plans we list, and to nothing else', () => {
  const plans = fundedseatPlansFrom(FS_API);
  assert.equal(plans.length, 11);
  assert.deepEqual(
    [...new Set(plans.map((p) => p.programName))].sort(),
    ['Daily', 'Instant Funding', 'Sprint'],
  );
  // Flex was dropped on 2026-08-21: gone from this endpoint AND from their tab
  // row, so nothing we list is left uncovered.
  assert.deepEqual(FUNDEDSEAT_API_UNCOVERED, []);
  assert.equal(FS_API.some((r) => /flex/i.test(r.name)), false);
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

test('the consistency that only shows once funded is kept apart from the eval one', () => {
  const plans = fundedseatPlansFrom(FS_API);
  // A Sprint card reads "Consistency: None" under Evaluation Rules and
  // "Consistency 1st payout 25%" under Funded Rules (read on their page,
  // 2026-08-21). The two must never be merged into one number.
  assert.equal(fsPlan(plans, 'Sprint', 50000).payoutConsistency, '25%');
  assert.equal('consistency' in fsPlan(plans, 'Sprint', 50000).rules, false);
  // Daily is the mirror image: 35% during the evaluation, nothing once funded.
  assert.equal(fsPlan(plans, 'Daily', 50000).payoutConsistency, null);
  assert.equal(fsPlan(plans, 'Daily', 50000).rules.consistency, '35%');
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
