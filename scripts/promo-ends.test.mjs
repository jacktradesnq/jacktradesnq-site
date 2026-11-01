import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { firmAt, promoEnds, runsAt } from '../lib/promo-ends.mjs';

const DATA = JSON.parse(fs.readFileSync(new URL('../public/data/compare-extra-firms.json', import.meta.url), 'utf8'));

const firm = {
  id: 'x',
  promo: { label: '30% off with code GEMS', code: 'GEMS', ends: '2026-10-31T23:59:00-04:00' },
  code: 'GEMS',
  programs: [
    { name: 'Growth', promoCode: 'GEMS', promoLabel: 'l', plans: [{ size: 25000, price: 69, originalPrice: 99 }] },
    { name: 'Other', plans: [{ size: 50000, price: 120 }] },
  ],
};
const ENDS = Date.parse('2026-11-01T03:59:00Z');

test('runsAt : avant la fin oui, à la fin non, sans date toujours', () => {
  assert.equal(runsAt('2026-10-31T23:59:00-04:00', ENDS - 1), true);
  assert.equal(runsAt('2026-10-31T23:59:00-04:00', ENDS), false);
  assert.equal(runsAt(null, ENDS * 2), true);
  assert.equal(runsAt(undefined, 0), true);
});

test('promo en cours : la firme est rendue telle quelle', () => {
  assert.equal(firmAt(firm, ENDS - 1), firm);
});

test('promo expirée : ni code ni prix remisé, prix catalogue sans barré', () => {
  const f = firmAt(firm, ENDS);
  assert.equal(f.promo, null);
  assert.equal(f.code, null);
  assert.deepEqual(f.programs[0], { name: 'Growth', plans: [{ size: 25000, price: 99, originalPrice: null }] });
  assert.deepEqual(f.programs[1].plans, [{ size: 50000, price: 120, originalPrice: null }]);
  assert.equal(firm.promo.code, 'GEMS'); // l'original n'est pas modifié
});

test('compare-extra-firms.json : une firme sans date de fin garde son code', () => {
  for (const f of DATA.firms.filter((x) => !x.promo?.ends)) assert.equal(firmAt(f, Date.parse('2100-01-01')), f);
});

test('les dates de fin à surveiller, en ms', () => {
  assert.deepEqual(promoEnds([firm, { promo: null }, { promo: { code: 'V' } }]), [ENDS]);
});
