// Parsing tests for the rule-drift check, run against a real payload saved from
// the firm's own store API. No network, no browser.
// Run: node --test scripts/check-rule-drift.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  handCheck,
  mergeFundedSeatSources,
  e8CardRules,
  BROKEN,
} from './check-rule-drift.mjs';

test('a card saying None on its eval face is no drift when their API charges at the payout', () => {
  // FundedSeat Sprint: the card's "Evaluation Rules" face says Consistency
  // None, and its "Funded Rules" face says 25% at the first payout. We publish
  // the rule a trader actually hits, so reading the eval face alone reported
  // four drifts every single day that were not drifts.
  const cards = [{ programName: 'Sprint', size: 50000, rules: { consistency: null, maxDrawdown: 2000 } }];
  const api = [{ programName: 'Sprint', size: 50000, payoutConsistency: '25%', rules: { maxDrawdown: 2000 } }];
  const [merged] = mergeFundedSeatSources(cards, api);
  assert.equal(merged.rules.consistency, '25%');
});

// Captured 2026-08-21 from the Configure Challenge widget on e8futures.com
const E8_CARD = readFileSync(new URL('./__fixtures__/e8-signature-card.txt', import.meta.url), 'utf8');

test('an E8 card that no longer lists contracts leaves the field unclaimed', () => {
  // Their Signature cards dropped the contract row in August: the word
  // "contract" appears zero times on that page now. Unclaimed sends it to the
  // manual list; claiming it broken cried scraper failure four times a day.
  const card = e8CardRules('E8 Signature Futures', E8_CARD);
  assert.equal(card.size, 25000);
  assert.equal(card.rules.profitTarget, 1500);
  assert.equal(card.rules.maxDrawdown, 1000);
  assert.equal('contracts' in card.rules, false);
});

test('the contract row coming back is read again, never left to the manual list', () => {
  const back = E8_CARD.replace('Drawdown type', 'Max contracts\n5\nDrawdown type');
  assert.deepEqual(e8CardRules('E8 Signature Futures', back).rules.contracts, { minis: 5, micros: null });
});

test('a contract row present but unreadable is a broken scraper, not an absent rule', () => {
  const mangled = E8_CARD.replace('Drawdown type', 'Max contracts\nask support\nDrawdown type');
  assert.equal(e8CardRules('E8 Signature Futures', mangled).rules.contracts, BROKEN);
});

test('a consistency they do publish on the eval is never replaced by the payout one', () => {
  const cards = [{ programName: 'Daily', size: 50000, rules: { consistency: '40%' } }];
  const api = [{ programName: 'Daily', size: 50000, payoutConsistency: '25%', rules: {} }];
  const [merged] = mergeFundedSeatSources(cards, api);
  assert.equal(merged.rules.consistency, '40%');
});

/* ------- rules read by hand: how long that reading is worth trusting ------- */

test('a firm read by hand recently is not a broken scraper', () => {
  const r = handCheck({ rulesCheckedAt: '2026-08-21' }, '2026-09-10');
  assert.equal(r.days, 20);
  assert.equal(r.expired, false);
});

test('an old reading stops covering for an unreadable site', () => {
  const r = handCheck({ rulesCheckedAt: '2026-08-21' }, '2026-10-30');
  assert.equal(r.days, 70);
  assert.equal(r.expired, true);
});

test('a stamp written one day ahead of UTC reads as today, not as the future', () => {
  assert.equal(handCheck({ rulesCheckedAt: '2026-08-21' }, '2026-08-20').days, 0);
});

test('no reading at all is no excuse', () => {
  assert.equal(handCheck({}, '2026-08-21'), null);
  assert.equal(handCheck({ rulesCheckedAt: 'un jour' }, '2026-08-21').expired, true);
});
