import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { vestPerpsFromSnapshot, slimProduct, DOUBLE_RE } from './lib/firms/perps-vest.mjs';

// Catalogue Vest relu le 28/11/2026 par readVestPerps (api-gateway.hz.vestmarkets.com/v3/payments,
// 8 Instant + 336 évals 1-Step) et la phrase « double their discount » de la doc account-tiers. Copie figée.
const SNAP = JSON.parse(fs.readFileSync(new URL('./lib/firms/fixtures/perps-vest-2026-11-28.json', import.meta.url), 'utf8'));
const PROMO = { code: 'JTNQ', discountPct: 10, endsAt: null, instantPct: 5, lastChecked: '2026-11-28' };
const read = (snap = SNAP, promo = PROMO) => vestPerpsFromSnapshot(snap, { checkedOn: '2026-11-28', promo });
const program = (r, name) => r.programs.find((p) => p.name === name);
const plan = (r, name, size) => program(r, name).plans.find((p) => p.size === size);
const clone = () => structuredClone(SNAP);

test('Vest du 28/11 : 12 programmes 1-Step (objectif × drawdown) + Instant, aucun 2-Step, aucune daily loss', () => {
  const r = read();
  assert.deepEqual(
    r.programs.map((p) => p.name),
    [5, 10, 15, 20].flatMap((t) => [6, 7, 8].map((d) => `1-Step · ${t}% · ${d}% Max`)).concat('Instant'),
  );
  assert.ok(!r.programs.some((p) => /2-Step/.test(p.name)));
  for (const p of r.programs) assert.equal(p.dailyLoss, 'None');
  const one = program(r, '1-Step · 10% · 6% Max');
  assert.deepEqual(one.plans.map((x) => x.size), [1000, 2500, 5000, 10000, 25000, 50000, 100000]);
  assert.equal(one.split, '70% / 80% / 90% / 95%');
  assert.equal(one.profitTarget, '10%');
  assert.equal(one.maxDrawdown, '6%');
  assert.equal(one.ddType, 'Static');
  assert.equal(one.rulesKey, '1-Step');
});

test('les prix de leur grille et de leur doc (« 10% target, 6% drawdown, 80% split » : $22 $55 $90 $180 $430 $850)', () => {
  const r = read();
  const at80 = [1000, 2500, 5000, 10000, 25000, 50000].map((s) => plan(r, '1-Step · 10% · 6% Max', s).altPrices[0].price);
  assert.deepEqual(at80, [22, 55, 90, 180, 430, 850]);
  // « 20% target, 6% drawdown, 70% split (lowest price) $13 $30 $55 $110 $270 $530 »
  assert.deepEqual([1000, 2500, 5000, 10000, 25000, 50000].map((s) => plan(r, '1-Step · 20% · 6% Max', s).price), [13, 30, 55, 110, 270, 530]);
  // « 5% target, 8% drawdown, 95% split (highest price) $65 $150 $260 $510 $1,260 $2,480 »
  assert.deepEqual([1000, 2500, 5000, 10000, 25000, 50000].map((s) => plan(r, '1-Step · 5% · 8% Max', s).altPrices[2].price), [65, 150, 260, 510, 1260, 2480]);
  const p = plan(r, '1-Step · 10% · 6% Max', 50000);
  assert.deepEqual(p.lines, [{ label: 'Max drawdown', value: '$3,000' }]);
  assert.equal(p.promoPrice, 711); // 790 - 10 %
  assert.deepEqual(p.altPrices, [
    { price: 850, promoPrice: 765 },
    { price: 1020, promoPrice: 918 },
    { price: 1140, promoPrice: 1026 },
  ]);
});

test('Instant : 8 tailles de $500 à $100K, prix = drawdown, 95 %, code à 5 %', () => {
  const r = read();
  const inst = program(r, 'Instant');
  assert.deepEqual(inst.plans.map((x) => [x.size, x.price, x.promoPrice]), [
    [500, 10, 9.5],
    [1000, 40, 38],
    [2500, 100, 95],
    [5000, 200, 190],
    [10000, 400, 380],
    [25000, 1000, 950],
    [50000, 2000, 1900],
    [100000, 4000, 3800],
  ]);
  assert.equal(inst.split, '95%');
  assert.equal(inst.maxDrawdown, '2–4%');
  assert.equal(inst.profitTarget, null);
  assert.deepEqual(inst.plans[0].lines, [{ label: 'Max drawdown', value: '$10 (2%)' }]);
});

test('remise JTNQ : évals au double du taux de base tant que la doc le dit, au taux de base sinon', () => {
  assert.deepEqual(read().promo, { code: 'JTNQ', discountPct: 10, endsAt: null, instantPct: 5, lastChecked: '2026-11-28' });
  const snap = clone();
  snap.docsDouble = false;
  const r = read(snap);
  assert.equal(r.promo.discountPct, 5);
  assert.equal(plan(r, '1-Step · 10% · 6% Max', 5000).promoPrice, 76); // 80 - 5 %
  assert.ok(DOUBLE_RE.test('For a limited time, creator codes give double their discount on Evaluation accounts.'));
});

test('un compte annoncé mais absent, un prix aberrant, une daily loss ou un 2-Step : illisible (firme stale)', () => {
  const missing = clone();
  missing.products = missing.products.filter((p) => !(p.type === 'eval' && p.size === 25000 && p.split === 0.95));
  assert.throws(() => read(missing), /Vest illisible : 1-Step \$25,000/);

  const crazy = clone();
  crazy.products.find((p) => p.type === 'instant_funded').price = 0;
  assert.throws(() => read(crazy), /prix aberrant/);

  const dll = clone();
  dll.options.oneStepRules.dailyLossPct.values = ['0', '0.03'];
  assert.throws(() => read(dll), /daily loss/);

  const twoStep = clone();
  twoStep.options.types.push({ productType: 'eval', stepsTotal: 2, accountSizes: ['5000'] });
  assert.throws(() => read(twoStep), /type de compte inconnu/);

  assert.throws(() => read({ options: {}, products: [] }), /Vest illisible/);
  assert.throws(() => read(SNAP, { code: 'JTNQ', discountPct: 10 }), /instantPct/);
});

test('slimProduct garde seulement ce que le site montre', () => {
  const p = slimProduct({
    productType: 'eval',
    name: 'Vest Capital 1-Step Evaluation Fee | 1K',
    price: { amount: '22.00', currency: 'USD' },
    plan: { accountSize: '1000.00000000', stepGoal: '100.00000000', maxDrawdownPct: '0.060000', maxDailyLossPct: '0', maxProfitSplitPct: '0.8000', stepsTotal: 1 },
  });
  assert.deepEqual(p, { type: 'eval', steps: 1, size: 1000, goal: 100, dd: 0.06, dll: 0, split: 0.8, price: 22, currency: 'USD', name: 'Vest Capital 1-Step Evaluation Fee | 1K' });
});
