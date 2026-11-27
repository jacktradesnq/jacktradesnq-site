import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyLossChoices } from '../lib/daily-loss-choices.mjs';

// Copies figées (CLAUDE.md : un test ne lit pas les données que la synchro réécrit chaque jour ;
// perps-firms.json est relu chaque jour par scripts/scrape-perps.mjs depuis le 28/11/2026).
// MFP Elite 5K et Vest « 1-Step · 10% » 5K tels qu'ils étaient dans perps-firms.json le 22/10/2026.
const MFP_ELITE = { name: 'Elite / Elite 3% DLL', dailyLoss: 'None / 3%' };
const MFP_ELITE_5K = { size: 5000, price: 89, promoPrice: 57, altPrice: 49, altPromoPrice: 31 };
const VEST_1STEP = { name: '1-Step · 10%', dailyLoss: '3%, 4% or none', priceLabel: '3% DLL' };
const VEST_1STEP_5K = {
  size: 5000,
  price: 40,
  promoPrice: 38,
  altPrice: 48,
  altPromoPrice: 45.6,
  more: [
    { label: '4% DLL', price: 60, promoPrice: 57, altPrice: 72, altPromoPrice: 68.4 },
    { label: 'No DLL', price: 75, promoPrice: 71.25, altPrice: 90, altPromoPrice: 85.5 },
  ],
};

test('MFP Elite: no limit first, then 3%, each with its own price', () => {
  const c = dailyLossChoices(MFP_ELITE, MFP_ELITE_5K);
  assert.deepEqual(c.map((x) => x.label), ['None', '3%']);
  assert.equal(c[0].price, 89);
  assert.equal(c[1].price, 49);
  assert.equal(c[1].promoPrice, 31);
});

test('a plan sold in several daily loss versions (Vest 1-Step until 23/11): 3%, 4%, None, and the second split price stays with its version', () => {
  const c = dailyLossChoices(VEST_1STEP, VEST_1STEP_5K);
  assert.deepEqual(c.map((x) => x.label), ['3%', '4%', 'None']);
  assert.equal(c[2].price, 75);
  assert.equal(c[2].altPrice, 90);
});

test('a plan sold one way has no buttons', () => {
  assert.equal(dailyLossChoices({ name: 'Classic', dailyLoss: '3%' }, { size: 5000, price: 45, promoPrice: 42.75 }), null);
  assert.equal(dailyLossChoices({ dailyLoss: 'None / 3%' }, { price: null }), null);
  // Vest 1-Step since 28/11/2026: four split prices, no daily loss: no buttons.
  assert.equal(
    dailyLossChoices({ name: '1-Step · 10% · 6% Max', dailyLoss: 'None' }, { size: 5000, price: 80, promoPrice: 72, altPrices: [{ price: 90, promoPrice: 81 }] }),
    null,
  );
});

// Contrôle de forme sur les données livrées : une version de plus est toujours une version de daily loss, avec un prix.
test('the shipped data: every version is a daily loss version, with a price', () => {
  const perps = JSON.parse(readFileSync(new URL('../public/data/perps-firms.json', import.meta.url), 'utf8'));
  for (const f of perps.firms)
    for (const p of f.programs)
      for (const plan of p.plans) {
        for (const m of plan.more ?? []) assert.match(m.label, /DLL/);
        for (const c of dailyLossChoices(p, plan) ?? []) assert.ok(c.price > 0, `${f.id} ${p.name} ${plan.size}`);
      }
});
