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

test('firme affiliée, promo expirée : son code reste imprimé, prix catalogue sans barré', () => {
  const partner = { ...firm, affiliate: true, code: 'JackTNQ', promo: { ...firm.promo, code: 'JackTNQ' } };
  partner.programs = [{ ...firm.programs[0], promoCode: 'JackTNQ' }, firm.programs[1]];
  assert.equal(firmAt(partner, ENDS - 1), partner);
  const f = firmAt(partner, ENDS);
  assert.equal(f.code, 'JackTNQ');
  assert.equal(f.promo, null);
  assert.deepEqual(f.programs[0], { name: 'Growth', plans: [{ size: 25000, price: 99, originalPrice: null }] });
  assert.deepEqual(f.programs[1].plans, [{ size: 50000, price: 120, originalPrice: null }]);
  // La même firme non affiliée perd son code comme avant.
  assert.equal(firmAt({ ...partner, affiliate: false }, ENDS).code, null);
});

// La promo du JSON change avec le bot : sa fin est fixée ici au 30/11/2026 (celle relue le 19/11).
const ENDS_1130 = '2026-11-30T23:59:00-05:00';

test('compare-extra-firms.json au 01/12/2026 (promo finie le 30/11) : Tradeify garde JackTNQ aux prix catalogue, Lucid perd son code comme avant', () => {
  const at = Date.parse('2026-12-01T12:00:00Z');
  const tradeify = structuredClone(DATA.firms.find((f) => f.id === 'tradeify'));
  tradeify.promo = { label: '30-45% off with code JackTNQ', code: 'JackTNQ', ...tradeify.promo, ends: ENDS_1130 };
  assert.equal(firmAt(tradeify, Date.parse(ENDS_1130) - 1), tradeify);
  const after = firmAt(tradeify, at);
  assert.equal(after.code, 'JackTNQ');
  assert.equal(after.promo, null);
  for (const pr of after.programs) {
    assert.ok(!('promoCode' in pr) && !('promoLabel' in pr), pr.name);
    for (const [i, pl] of pr.plans.entries()) {
      const before = tradeify.programs.find((p) => p.name === pr.name).plans[i];
      assert.equal(pl.price, before.originalPrice ?? before.price, `${pr.name} ${pl.size}`);
      assert.equal(pl.originalPrice, null);
    }
  }
  // Lucid (non affiliée) avec la même date de fin : ni code ni prix remisés, l'ancien comportement.
  const lucid = structuredClone(DATA.firms.find((f) => f.id === 'lucid-trading'));
  assert.equal(lucid.affiliate, false);
  lucid.promo = { ...lucid.promo, ends: ENDS_1130 };
  const lucidAfter = firmAt(lucid, at);
  assert.equal(lucidAfter.code, null);
  assert.equal(lucidAfter.promo, null);
  assert.ok(lucidAfter.programs.every((pr) => pr.plans.every((pl) => pl.originalPrice === null)));
});

test('compare-extra-firms.json : une firme sans date de fin garde son code', () => {
  for (const f of DATA.firms.filter((x) => !x.promo?.ends)) assert.equal(firmAt(f, Date.parse('2100-01-01')), f);
});

test('les dates de fin à surveiller, en ms', () => {
  assert.deepEqual(promoEnds([firm, { promo: null }, { promo: { code: 'V' } }]), [ENDS]);
});
