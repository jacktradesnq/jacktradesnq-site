// Parsing tests for the price sync, run against real markup saved from the
// firms' own pages. No network, no browser.
// Run: node --test scripts/scrape-prop-firms.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { topOneActivationFees, legendsUpdatesFrom, legendsActivationFee } from './scrape-prop-firms.mjs';

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
