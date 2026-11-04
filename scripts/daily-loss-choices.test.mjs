import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyLossChoices } from '../lib/daily-loss-choices.mjs';

const perps = JSON.parse(readFileSync(new URL('../public/data/perps-firms.json', import.meta.url), 'utf8'));
const program = (firm, name) => perps.firms.find((f) => f.id === firm).programs.find((p) => p.name === name);

test('MFP Elite: no limit first, then 3%, each with its own price', () => {
  const p = program('myfundedperps', 'Elite / Elite 3% DLL');
  const c = dailyLossChoices(p, p.plans[0]);
  assert.deepEqual(c.map((x) => x.label), ['None', '3%']);
  assert.equal(c[0].price, p.plans[0].price);
  assert.equal(c[1].price, p.plans[0].altPrice);
  assert.equal(c[1].promoPrice, p.plans[0].altPromoPrice);
});

test('Vest 1-Step: 3%, 4%, None, and the 90% split price stays with its version', () => {
  const p = program('vest-markets', '1-Step · 10%');
  const plan = p.plans[0];
  const c = dailyLossChoices(p, plan);
  assert.deepEqual(c.map((x) => x.label), ['3%', '4%', 'None']);
  assert.equal(c[2].price, plan.more[1].price);
  assert.equal(c[2].altPrice, plan.more[1].altPrice);
});

test('a plan sold one way has no buttons', () => {
  const p = program('breakout', 'Classic');
  assert.equal(dailyLossChoices(p, p.plans[0]), null);
  assert.equal(dailyLossChoices({ dailyLoss: 'None / 3%' }, { price: null }), null);
});

test('the shipped data: every version is a daily loss version, with a price', () => {
  let seen = 0;
  for (const f of perps.firms)
    for (const p of f.programs)
      for (const plan of p.plans) {
        for (const m of plan.more ?? []) assert.match(m.label, /DLL/);
        for (const c of dailyLossChoices(p, plan) ?? []) {
          assert.ok(c.price > 0, `${f.id} ${p.name} ${plan.size}`);
          seen += 1;
        }
      }
  assert.ok(seen > 0);
});
