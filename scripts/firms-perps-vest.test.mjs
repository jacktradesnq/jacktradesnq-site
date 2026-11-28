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
// Le prix d'une combinaison (objectif, drawdown, split en %) d'une taille du 1-Step.
const combo = (r, size, profitTarget, maxDrawdown, split) =>
  plan(r, '1-Step', size).grid.find((g) => g.profitTarget === profitTarget && g.maxDrawdown === maxDrawdown && g.split === split);
const clone = () => structuredClone(SNAP);

test('Vest du 28/11 : un seul 1-Step à curseurs (objectif, drawdown, split) + Instant, aucun 2-Step, aucune daily loss', () => {
  const r = read();
  assert.deepEqual(r.programs.map((p) => p.name), ['1-Step', 'Instant']);
  assert.ok(!r.programs.some((p) => /2-Step/.test(p.name)));
  for (const p of r.programs) assert.equal(p.dailyLoss, 'None');
  const one = program(r, '1-Step');
  assert.deepEqual(one.plans.map((x) => x.size), [1000, 2500, 5000, 10000, 25000, 50000, 100000]);
  assert.equal(one.split, '70% / 80% / 90% / 95%');
  assert.equal(one.profitTarget, '5–20%');
  assert.equal(one.maxDrawdown, '6–8%');
  assert.equal(one.ddType, 'Static');
  assert.deepEqual(one.sliders, [
    { field: 'profitTarget', label: 'Profit target', values: [5, 10, 15, 20], default: 10 },
    { field: 'maxDrawdown', label: 'Max drawdown', values: [6, 7, 8], default: 6 },
    { field: 'split', label: 'Profit split', values: [70, 80, 90, 95], default: 80 },
  ]);
  // Chaque taille porte ses 48 combinaisons (4 objectifs × 3 drawdowns × 4 splits), aucune en double.
  for (const p of one.plans) {
    assert.equal(p.grid.length, 48);
    assert.equal(new Set(p.grid.map((g) => `${g.profitTarget}|${g.maxDrawdown}|${g.split}`)).size, 48);
    assert.equal(p.altPrices, undefined);
  }
});

test('position de départ = les défauts de leur catalogue (« default » 0.1 / 0.06 / 0.8), lus, pas écrits en dur', () => {
  const r = read();
  const p = plan(r, '1-Step', 5000);
  assert.equal(p.price, 90); // 10 % / 6 % / 80 %
  assert.equal(p.promoPrice, 81);
  assert.deepEqual(p.lines, [{ label: 'Max drawdown', value: '$300' }]);

  const moved = clone();
  moved.options.oneStepRules.profitTargetPct.default = '0.2';
  moved.options.oneStepRules.maxDrawdownPct.default = '0.08';
  moved.options.oneStepRules.profitSplitPct.default = '0.7';
  const m = read(moved);
  assert.deepEqual(program(m, '1-Step').sliders.map((s) => s.default), [20, 8, 70]);
  const q = plan(m, '1-Step', 5000);
  assert.equal(q.price, combo(m, 5000, 20, 8, 70).price);
  assert.deepEqual(q.lines, [{ label: 'Max drawdown', value: '$400' }]);

  const off = clone();
  off.options.oneStepRules.maxDrawdownPct.default = '0.05';
  assert.throws(() => read(off), /Vest illisible : 1-Step : le défaut de maxDrawdownPct/);
  const none = clone();
  delete none.options.oneStepRules.profitSplitPct.default;
  assert.throws(() => read(none), /Vest illisible : 1-Step : le défaut de profitSplitPct/);
});

test('les prix de leur grille et de leur doc (« 10% target, 6% drawdown, 80% split » : $22 $55 $90 $180 $430 $850)', () => {
  const r = read();
  const sizes = [1000, 2500, 5000, 10000, 25000, 50000];
  assert.deepEqual(sizes.map((s) => combo(r, s, 10, 6, 80).price), [22, 55, 90, 180, 430, 850]);
  // La combinaison par défaut est aussi le prix de la ligne.
  assert.deepEqual(sizes.map((s) => plan(r, '1-Step', s).price), [22, 55, 90, 180, 430, 850]);
  // « 20% target, 6% drawdown, 70% split (lowest price) $13 $30 $55 $110 $270 $530 »
  assert.deepEqual(sizes.map((s) => combo(r, s, 20, 6, 70).price), [13, 30, 55, 110, 270, 530]);
  // « 5% target, 8% drawdown, 95% split (highest price) $65 $150 $260 $510 $1,260 $2,480 »
  assert.deepEqual(sizes.map((s) => combo(r, s, 5, 8, 95).price), [65, 150, 260, 510, 1260, 2480]);
  const p = plan(r, '1-Step', 50000);
  assert.deepEqual(p.lines, [{ label: 'Max drawdown', value: '$3,000' }]);
  assert.equal(p.promoPrice, 765); // 850 - 10 %
  assert.deepEqual(
    [70, 80, 90, 95].map((s) => combo(r, 50000, 10, 6, s)),
    [
      { profitTarget: 10, maxDrawdown: 6, split: 70, price: 790, promoPrice: 711 },
      { profitTarget: 10, maxDrawdown: 6, split: 80, price: 850, promoPrice: 765 },
      { profitTarget: 10, maxDrawdown: 6, split: 90, price: 1020, promoPrice: 918 },
      { profitTarget: 10, maxDrawdown: 6, split: 95, price: 1140, promoPrice: 1026 },
    ],
  );
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
  assert.equal(plan(r, '1-Step', 5000).promoPrice, 85.5); // 90 - 5 %
  assert.equal(combo(r, 5000, 10, 6, 70).promoPrice, 76); // 80 - 5 %
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
