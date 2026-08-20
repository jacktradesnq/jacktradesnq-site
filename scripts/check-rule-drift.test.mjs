// Parsing tests for the rule-drift check, run against a real payload saved from
// the firm's own store API. No network, no browser.
// Run: node --test scripts/check-rule-drift.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { legendsRulesFrom, BROKEN } from './check-rule-drift.mjs';

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
