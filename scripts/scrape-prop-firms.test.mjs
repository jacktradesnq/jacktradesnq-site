// Parsing tests for the price sync, run against real markup saved from the
// firms' own pages. No network, no browser.
// Run: node --test scripts/scrape-prop-firms.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { topOneActivationFees } from './scrape-prop-firms.mjs';

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
