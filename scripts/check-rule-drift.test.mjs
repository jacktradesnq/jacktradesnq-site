// Parsing tests for the rule-drift check, run against a real payload saved from
// the firm's own store API. No network, no browser.
// Run: node --test scripts/check-rule-drift.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  legendsRulesFrom,
  handCheck,
  mergeFundedSeatSources,
  e8CardRules,
  topOneCardRules,
  BROKEN,
} from './check-rule-drift.mjs';

// Captured 2026-08-20 from api.thelegendstrading.com/shop/plans
const LEGENDS = JSON.parse(readFileSync(new URL('./__fixtures__/legends-shop-plans.json', import.meta.url), 'utf8'));
const plan = (rules, programName, size) => rules.find((r) => r.programName === programName && r.size === size);

test('every plan their store sells comes back with its rules', () => {
  const rules = legendsRulesFrom(LEGENDS);
  assert.equal(rules.length, 7);
  assert.deepEqual([...new Set(rules.map((r) => r.programName))].sort(), ['Apprentice', 'Elite']);
  assert.deepEqual(
    rules.filter((r) => r.programName === 'Elite').map((r) => r.size).sort((a, b) => a - b),
    [25000, 50000, 100000, 150000],
  );
});

test('both of their wordings are read, and they mean the same thing', () => {
  const rules = legendsRulesFrom(LEGENDS);
  // Apprentice: "$3,000 profit goal | $2,000 EOD trailing max loss"
  const apprentice = plan(rules, 'Apprentice', 50000);
  assert.equal(apprentice.rules.profitTarget, 3000);
  assert.equal(apprentice.rules.maxDrawdown, 2000);
  assert.deepEqual(apprentice.rules.contracts, { minis: 2, micros: 20 });
  // Elite: "$2,700 Profit Target | $2,200 EOD Trailing Max Loss"
  const elite = plan(rules, 'Elite', 50000);
  assert.equal(elite.rules.profitTarget, 2700);
  assert.equal(elite.rules.maxDrawdown, 2200);
  assert.deepEqual(elite.rules.contracts, { minis: 4, micros: 40 });
});

test('"No consistency required" is a claim, and it is read as one', () => {
  const rules = legendsRulesFrom(LEGENDS);
  // Their /plans page still advertises "Consistency 30%" on Apprentice, from the
  // same stale table that prices it at $185 when the store charges $59. Our page
  // carried that 30% until this parser read their API instead.
  assert.equal(plan(rules, 'Apprentice', 50000).rules.consistency, null);
  assert.equal(plan(rules, 'Apprentice', 150000).rules.consistency, null);
  assert.equal(plan(rules, 'Elite', 50000).rules.consistency, '40%');
});

test('a rule they do not mention is left unclaimed, not claimed absent', () => {
  const rules = legendsRulesFrom(LEGENDS);
  // Elite spells out "Daily Loss Limit: None"; Apprentice says nothing at all.
  assert.equal(plan(rules, 'Elite', 50000).rules.dailyLoss, null);
  assert.equal('dailyLoss' in plan(rules, 'Apprentice', 50000).rules, false);
});

test('wording they change is unreadable, never silently absent', () => {
  const mangled = {
    data: [
      {
        productCategory: 'Elite',
        storeDisplayName: '$50,000 Elite',
        shortDescription: 'unlimited contracts',
        description: 'Code: LTG | consistency rule applies | drawdown applies',
      },
    ],
  };
  const [r] = legendsRulesFrom(mangled);
  assert.equal(r.rules.profitTarget, BROKEN);
  assert.equal(r.rules.maxDrawdown, BROKEN);
  assert.equal(r.rules.consistency, BROKEN);
  assert.equal(r.rules.contracts, BROKEN);
});

test('an empty answer is a failure, never a firm with no rules', () => {
  assert.throws(() => legendsRulesFrom({ data: [] }), /no plans/);
  assert.throws(() => legendsRulesFrom([]), /no plans/);
});

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

/* ------- Top One: every card has two faces, eval and funded ------- */

const topOneCard = (file) => {
  const pane = readFileSync(new URL(`./__fixtures__/${file}`, import.meta.url), 'utf8');
  const at = [...pane.matchAll(/v3-pricing-title">\$(\d+)K/g)].map((m) => m.index);
  return pane.slice(at[0], at[1]); // the $25K card
};

test('a consistency rule that only exists once funded is still published', () => {
  // Elite Access: "Consistency on Eval None!" on the face you land on, and
  // "Consistency 40%" on the funded face of the same card, all four sizes.
  // Our page said None, which is the half that suits them.
  const rules = topOneCardRules(topOneCard('top-one-elite-access.pane.html'));
  assert.equal(rules.consistency, '40% (funded)');
});

test('the eval rule wins when the eval face states one', () => {
  // Elite Daily is the mirror image: 40% during the challenge, none once
  // funded. The rule a trader meets first is the one that gets printed.
  const rules = topOneCardRules(topOneCard('top-one-elite-daily.pane.html'));
  assert.equal(rules.consistency, '40%');
  assert.equal(rules.dailyLoss, 500);
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

test('what their API says matches the published JSON, field by field', () => {
  const firm = JSON.parse(readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'))
    .firms.find((f) => f.id === 'legends-trading');
  const rules = legendsRulesFrom(LEGENDS);
  let checked = 0;
  for (const program of firm.programs) {
    for (const p of program.plans) {
      const api = plan(rules, program.name, p.size);
      assert.ok(api, `${program.name} $${p.size} is on our page but not in their store`);
      const tag = `${program.name} ${p.size}`;
      assert.equal(p.profitTarget, api.rules.profitTarget, `${tag} profitTarget`);
      assert.equal(p.maxDrawdown, api.rules.maxDrawdown, `${tag} maxDrawdown`);
      assert.equal(
        p.consistency === 'None' ? null : p.consistency,
        api.rules.consistency,
        `${tag} consistency`,
      );
      assert.equal(p.contracts, `${api.rules.contracts.minis} minis / ${api.rules.contracts.micros} micros`, `${tag} contracts`);
      checked++;
    }
  }
  assert.equal(checked, 7);
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
