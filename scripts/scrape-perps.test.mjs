import test from 'node:test';
import assert from 'node:assert/strict';

import { runPerps, describeChanges } from './scrape-perps.mjs';

const NOW = Date.parse('2026-11-28T06:17:00Z');
const quiet = () => {};
const firm = (id, programs, promo = { code: 'JTNQ', discountPct: 5, endsAt: null, lastChecked: '2026-10-13' }) => ({
  id,
  name: id,
  lastChecked: '2026-10-13',
  markets: ['Crypto'],
  promo,
  programs,
});
const prog = (name, plans, extra = {}) => ({ name, steps: '1 step', split: '80%', profitTarget: '10%', maxDrawdown: '6%', ddType: 'Static', dailyLoss: '3%', note: '', plans, ...extra });
const reader = (programs, promo) => ({ read: async () => ({ ok: true }), apply: (snap, f, checkedOn) => ({ programs, promo: { ...(promo ?? f.promo), lastChecked: checkedOn } }) });

test('une firme relue : programmes et promo remplacés, lastChecked du jour, stale false, changements listés', async () => {
  const data = { generatedAt: '2026-11-01', firms: [firm('a', [prog('Classic', [{ size: 5000, price: 45, promoPrice: 42.75 }]), prog('Old', [{ size: 5000, price: 10, promoPrice: 9.5 }])])] };
  const lines = [];
  const res = await runPerps(data, {
    readers: { a: reader([prog('Classic', [{ size: 5000, price: 50, promoPrice: 37.5 }, { size: 10000, price: 85, promoPrice: 63.75 }]), prog('New', [{ size: 5000, price: 20, promoPrice: 15 }])], { code: 'JTNQ', discountPct: 25, endsAt: '2026-11-30T23:59:00Z' }) },
    now: NOW,
    log: (l) => lines.push(l),
  });
  assert.equal(res.ok, true);
  const f = data.firms[0];
  assert.equal(f.lastChecked, '2026-11-28');
  assert.equal(f.stale, false);
  assert.equal(data.generatedAt, '2026-11-28');
  assert.deepEqual(f.programs.map((p) => p.name), ['Classic', 'New']);
  assert.deepEqual(res.changes.a, [
    '+ programme New (5K)',
    '- programme Old',
    'Classic : + 10K (85)',
    'Classic 5K : prix 45 -> 50',
    'promo {"code":"JTNQ","discountPct":5,"endsAt":null} -> {"code":"JTNQ","discountPct":25,"endsAt":"2026-11-30T23:59:00Z"}',
  ]);
  assert.match(lines.join('\n'), /a: OK — 2 programmes, 3 comptes relus, 5 changement\(s\)/);
});

test('une page illisible : données gardées, stale true, ok false (job rouge) ; les autres firmes relues quand même', async () => {
  const old = [prog('Classic', [{ size: 5000, price: 45, promoPrice: 42.75 }])];
  const data = { firms: [firm('a', structuredClone(old)), firm('b', [prog('Pro', [{ size: 5000, price: 33, promoPrice: 31.35 }])])] };
  const lines = [];
  const res = await runPerps(data, {
    readers: {
      a: { read: async () => { throw new Error('HTTP 403 sur https://a.example'); }, apply: () => ({}) },
      b: reader([prog('Pro', [{ size: 5000, price: 33, promoPrice: 31.35 }])]),
    },
    now: NOW,
    log: (l) => lines.push(l),
  });
  assert.equal(res.ok, false);
  assert.deepEqual(data.firms[0].programs, old);
  assert.equal(data.firms[0].stale, true);
  assert.equal(data.firms[0].lastChecked, '2026-10-13');
  assert.equal(data.firms[1].stale, false);
  assert.match(lines.join('\n'), /a: ÉCHEC — HTTP 403/);
  assert.match(lines.join('\n'), /b: OK — 1 programmes, 1 comptes relus, rien n'a changé/);
});

test('un lecteur qui lève sur une lecture incomplète, ou qui ne rend aucun programme : stale', async () => {
  const data = { firms: [firm('a', [prog('Classic', [{ size: 5000, price: 45 }])]), firm('b', [prog('Pro', [{ size: 5000, price: 33 }])])] };
  const res = await runPerps(data, {
    readers: {
      a: { read: async () => ({}), apply: () => { throw new Error('a illisible : Classic 10K annoncé mais absent'); } },
      b: { read: async () => ({}), apply: () => ({ programs: [], promo: null }) },
    },
    now: NOW,
    log: quiet,
  });
  assert.equal(res.ok, false);
  assert.equal(data.firms[0].stale, true);
  assert.equal(data.firms[1].stale, true);
  assert.equal(data.firms[1].programs.length, 1);
});

test('une firme sans lecteur : stale et job rouge (jamais oubliée en silence) ; --only saute les autres', async () => {
  const data = { firms: [firm('a', [prog('Classic', [{ size: 5000, price: 45 }])]), firm('z', [prog('X', [{ size: 5000, price: 1 }])])] };
  const res = await runPerps(data, { readers: { a: reader([prog('Classic', [{ size: 5000, price: 45 }])]) }, now: NOW, log: quiet });
  assert.equal(res.ok, false);
  assert.equal(data.firms[1].stale, true);

  const data2 = { firms: [firm('a', [prog('Classic', [{ size: 5000, price: 45 }])]), firm('z', [prog('X', [{ size: 5000, price: 1 }])])] };
  const res2 = await runPerps(data2, { readers: { a: reader([prog('Classic', [{ size: 5000, price: 45 }])]) }, now: NOW, log: quiet, only: ['a'] });
  assert.equal(res2.ok, true);
  assert.equal(data2.firms[1].stale, undefined);
});

test('describeChanges : règles, prix des autres splits, prix JTNQ seuls, pairs', () => {
  const before = firm('e', [prog('E8 One · 4% Max', [{ size: 5000, price: 40, promoPrice: 20, altPrices: [{ price: 44, promoPrice: 22 }] }], { split: '80% / 90%' })]);
  const after = structuredClone(before);
  after.programs[0].split = '80% / 90% / 100%';
  after.programs[0].plans[0].altPrices.push({ price: 48, promoPrice: 24 });
  after.pairs = { count: 70, title: 'x' };
  assert.deepEqual(describeChanges(before, after), [
    'E8 One · 4% Max : split "80% / 90%" -> "80% / 90% / 100%"',
    'E8 One · 4% Max 5K : prix 40 / 44 -> 40 / 44 / 48',
    'pairs null -> {"count":70,"title":"x"}',
  ]);
  const cheaper = structuredClone(before);
  cheaper.programs[0].plans[0].promoPrice = 30;
  assert.deepEqual(describeChanges(before, cheaper), ['E8 One · 4% Max 5K : prix JTNQ 20 / 22 -> 30 / 22']);
});
