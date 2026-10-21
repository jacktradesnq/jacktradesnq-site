// Parsing tests for the rule-drift check, run against a saved card. No network,
// no browser.
// Run: node --test scripts/check-rule-drift.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  handCheck,
  e8CardRules,
  BROKEN,
} from './check-rule-drift.mjs';

// Captured 2026-10-21 from the configurator on e8futures.com (Signature $25K panel).
const E8_PANELS = JSON.parse(
  readFileSync(new URL('./lib/firms/fixtures/e8-configurator-2026-10-21.json', import.meta.url), 'utf8'),
);
const E8_CARD = E8_PANELS[0].text;

test('an E8 panel that no longer lists contracts leaves the field unclaimed', () => {
  // Their Signature cards dropped the contract row in August: the word
  // "contract" appears zero times on that page now. Unclaimed sends it to the
  // manual list; claiming it broken cried scraper failure four times a day.
  const card = e8CardRules(E8_CARD);
  assert.equal(card.programName, 'E8 Signature Futures');
  assert.equal(card.size, 25000);
  assert.equal(card.rules.profitTarget, 1500);
  assert.equal(card.rules.maxDrawdown, 1000);
  assert.equal('contracts' in card.rules, false);
});

test('the Signature funded-account 35% is not read as the challenge consistency', () => {
  assert.equal(e8CardRules(E8_CARD).rules.consistency, null);
  assert.equal(e8CardRules(E8_PANELS[4].text).rules.consistency, '40%');
});

test('the contract row coming back is read again, never left to the manual list', () => {
  const back = E8_CARD.replace('PERFORMANCE RULES', 'Max contracts\n5\n\nPERFORMANCE RULES');
  assert.deepEqual(e8CardRules(back).rules.contracts, { minis: 5, micros: null });
});

test('a contract row present but unreadable is a broken scraper, not an absent rule', () => {
  const mangled = E8_CARD.replace('PERFORMANCE RULES', 'Max contracts\nask support\n\nPERFORMANCE RULES');
  assert.equal(e8CardRules(mangled).rules.contracts, BROKEN);
});

test('a drawdown row the panel lost is broken, not zero', () => {
  const lost = E8_CARD.replace('EOD Dynamic Drawdown\n$1,000\nPass in', 'Pass in');
  assert.equal(e8CardRules(lost).rules.maxDrawdown, BROKEN);
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
