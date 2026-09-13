import test from 'node:test';
import assert from 'node:assert/strict';

import { LEGENDS_API, fetchLegendsPrograms, programsFrom } from './lib/firms/legends.mjs';
import { readFileSync } from 'node:fs';

const payload = JSON.parse(
  readFileSync(new URL('./lib/firms/fixtures/legends-plans-2026-09-13.json', import.meta.url), 'utf8'),
);

const programs = programsFrom(payload);
const programme = (name) => programs.find((p) => p.name === name);
const plan = (name, size) => programme(name)?.plans.find((p) => p.size === size);

test('programsFrom : seuls Apprentice et Elite sortent, dans cet ordre', () => {
  assert.deepEqual(
    programs.map((p) => p.name),
    ['Apprentice', 'Elite'],
  );
});

test('programsFrom : Straight to Master (cache) et Master (post-reussite) ne sortent jamais', () => {
  const noms = programs.map((p) => p.name);
  assert.ok(!noms.includes('Straight to Master'));
  assert.ok(!noms.includes('Master'));
  const tailles = programs.flatMap((p) => p.plans.map((pl) => pl.size));
  assert.equal(tailles.length, 3 + 4, 'exactement 3 Apprentice + 4 Elite, aucun doublon de taille');
});

test('programsFrom : Apprentice a ses 3 tailles, mensuel, prix remise + prix plein', () => {
  const app = programme('Apprentice');
  assert.equal(app.type, 'eval');
  assert.equal(app.priceType, 'monthly');
  assert.deepEqual(
    app.plans.map((p) => p.size),
    [50000, 100000, 150000],
  );
  assert.deepEqual(
    app.plans.map((p) => p.price),
    [35.4, 64.2, 82.8],
  );
  assert.deepEqual(
    app.plans.map((p) => p.originalPrice),
    [59, 107, 138],
  );
});

test('programsFrom : Elite a ses 4 tailles, one-time, prix remise + prix plein', () => {
  const elite = programme('Elite');
  assert.equal(elite.type, 'eval');
  assert.equal(elite.priceType, 'one-time');
  assert.deepEqual(
    elite.plans.map((p) => p.size),
    [25000, 50000, 100000, 150000],
  );
  assert.deepEqual(
    elite.plans.map((p) => p.price),
    [83.3, 105.7, 158.9, 242.9],
  );
  assert.deepEqual(
    elite.plans.map((p) => p.originalPrice),
    [119, 151, 227, 347],
  );
});

test('programsFrom : les regles Apprentice sont celles du texte, rien de plus', () => {
  const p = plan('Apprentice', 50000);
  assert.equal(p.profitTarget, 3000);
  assert.equal(p.maxDrawdown, 2000);
  assert.equal(p.ddType, 'EOD Trailing');
  assert.equal(p.consistency, 'None');
  assert.equal(p.contracts, '2 minis / 20 micros');
  assert.equal(p.activationFee, 59);
  assert.ok(!('dailyLoss' in p), 'Apprentice ne mentionne jamais de daily loss : cle absente, pas null');
});

test('programsFrom : les regles Elite, avec dailyLoss et activationFee explicitement a None', () => {
  const p = plan('Elite', 150000);
  assert.equal(p.profitTarget, 9000);
  assert.equal(p.maxDrawdown, 4500);
  assert.equal(p.ddType, 'EOD Trailing');
  assert.equal(p.consistency, '40%');
  assert.equal(p.contracts, '12 minis / 120 micros');
  assert.equal(p.dailyLoss, null, 'Elite dit "Daily Loss Limit: None" : null explicite');
  assert.equal(p.activationFee, null, 'Elite dit "Activation Fee: None" : null explicite');
});

test('programsFrom : activation fee Apprentice differente par taille', () => {
  assert.equal(plan('Apprentice', 50000).activationFee, 59);
  assert.equal(plan('Apprentice', 100000).activationFee, 79);
  assert.equal(plan('Apprentice', 150000).activationFee, 89);
});

test('programsFrom : aucune valeur inventee, chaque plan garde exactement ses cles connues', () => {
  const attendues = new Set([
    'size',
    'price',
    'originalPrice',
    'profitTarget',
    'maxDrawdown',
    'ddType',
    'dailyLoss',
    'consistency',
    'contracts',
    'activationFee',
  ]);
  for (const p of programs) {
    for (const pl of p.plans) {
      for (const k of Object.keys(pl)) assert.ok(attendues.has(k), `cle inattendue : ${k}`);
    }
  }
});

test('programsFrom : Apprentice ne sort jamais isPublic:false (ex: 25K, No Activation Fee)', () => {
  assert.equal(plan('Apprentice', 25000), undefined, '25K Apprentice n est jamais public');
});

test('programsFrom : deux lignes de la meme case a des prix differents, on refuse de choisir', () => {
  const casse = payload.data.map((r) =>
    r.id === '1bfb4b39-d662-46a9-ad05-79e6da0fefa7' ? { ...r, price: 999 } : r,
  );
  assert.throws(() => programsFrom({ data: casse }), /prix differents/);
});

test('programsFrom : Apprentice ou Elite qui disparait du public arrete tout', () => {
  const sansElite = payload.data.map((r) => (r.productCategory === 'Elite' ? { ...r, isPublic: false } : r));
  assert.throws(() => programsFrom({ data: sansElite }), /Apprentice et Elite publics/);
});

test('programsFrom : un payload vide se plaint au lieu de rendre zero programme', () => {
  assert.throws(() => programsFrom({ data: [] }), /payload.data absent ou vide/);
  assert.throws(() => programsFrom(null), /payload.data absent ou vide/);
  assert.throws(() => programsFrom({}), /payload.data absent ou vide/);
});

test('fetchLegendsPrograms : lit l API et rend les programmes', async () => {
  let vu = null;
  const fetchImpl = async (url) => {
    vu = url;
    return { ok: true, json: async () => payload };
  };
  const progs = await fetchLegendsPrograms({ fetchImpl });
  assert.equal(vu, LEGENDS_API);
  assert.equal(progs.length, 2);
});

test('fetchLegendsPrograms : une panne se dit clairement, elle ne se devine pas', async () => {
  await assert.rejects(
    fetchLegendsPrograms({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );
  await assert.rejects(
    fetchLegendsPrograms({
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
    }),
    /injoignable/,
  );
  await assert.rejects(
    fetchLegendsPrograms({ fetchImpl: async () => ({ ok: true, json: async () => ({ data: [] }) }) }),
    /payload.data absent ou vide/,
  );
});
