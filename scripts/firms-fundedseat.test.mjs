import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FAMILY_ORDER,
  FUNDEDSEAT_API,
  fetchFundedSeatPrograms,
  parseFamily,
  programsFrom,
} from './lib/firms/fundedseat.mjs';
import { readFileSync } from 'node:fs';

const payload = JSON.parse(
  readFileSync(new URL('./lib/firms/fixtures/fundedseat-pullchallenges-2026-09-13.json', import.meta.url), 'utf8'),
);

const programs = programsFrom(payload);
const famille = (name) => programs.find((p) => p.name === name);
const plan = (name, size) => famille(name)?.plans.find((p) => p.size === size);

test('parseFamily : le nom exact donne la famille et la taille', () => {
  assert.deepEqual(parseFamily('1 Step Daily Ultra (35%) - 50K'), {
    family: 'Daily Ultra (35%)',
    size: 50000,
  });
  assert.deepEqual(parseFamily('1 Step Daily (35%) - 25K'), { family: 'Daily', size: 25000 });
  assert.deepEqual(parseFamily('1 Step Daily Max - 50K'), { family: 'Daily Max', size: 50000 });
  assert.deepEqual(parseFamily('1 Step Sprint'), { family: 'Sprint', size: null });
  assert.deepEqual(parseFamily('Instant Funding Direct'), {
    family: 'Instant Funding Direct',
    size: null,
  });
});

test('parseFamily : leur espace finale ne fabrique pas une autre famille', () => {
  assert.deepEqual(parseFamily('Instant Funding Bolt - 100K '), {
    family: 'Instant Funding Bolt',
    size: 100000,
  });
  assert.equal(parseFamily('Instant Funding Bolt - 100K ').family, parseFamily('Instant Funding Bolt - 50K').family);
});

test('parseFamily : Ultra n est jamais confondu avec Daily', () => {
  assert.notEqual(
    parseFamily('1 Step Daily Ultra (35%) - 50K').family,
    parseFamily('1 Step Daily (35%) - 50K').family,
  );
});

test('programsFrom : les 7 familles vendues, dans l ordre', () => {
  assert.deepEqual(programs.map((p) => p.name), FAMILY_ORDER);
  assert.equal(programs.length, 7, 'le dataset du site n en connait que 3');
});

test('programsFrom : les deux Ultra sont la, chacune avec ses prix', () => {
  assert.ok(famille('Daily Ultra (35%)'), 'Ultra (35%) manquait dans la tournee');
  assert.ok(famille('Daily Ultra (25%)'));
  assert.equal(plan('Daily Ultra (35%)', 50000).price, 197.5);
  assert.equal(plan('Daily Ultra (25%)', 50000).price, 252.5);
});

test('programsFrom : les plans sont tries par taille', () => {
  for (const p of programs) {
    const sizes = p.plans.map((x) => x.size);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), p.name);
  }
});

test('programsFrom : une daily loss non encodee n invente aucune cle', () => {
  const ultra25 = plan('Daily Ultra (25%)', 50000);
  assert.ok(!('dailyLoss' in ultra25), JSON.stringify(ultra25));
});

test('programsFrom : la daily loss lue est celle du CHALLENGE, pas du compte finance', () => {
  assert.equal(plan('Daily Max', 50000).dailyLoss, 1000);
  // Sprint 50K : 1000 a la racine (compte finance), 1200 dans le step 1.
  assert.equal(plan('Sprint', 50000).dailyLoss, 1200);
});

test('programsFrom : un nom actif a 3 prix garde ses 3 variantes et affiche la moins chere', () => {
  const p = plan('Daily Ultra (35%)', 100000);
  assert.equal(p.priceAmbiguous, true);
  assert.equal(p.variants.length, 3);
  assert.deepEqual(p.variants.map((v) => v.price), [264.5, 297.5, 451.5]);
  assert.equal(p.price, Math.min(...p.variants.map((v) => v.price)));
  assert.equal(p.price, 264.5);
});

test('programsFrom : un nom actif une seule fois ne porte aucun avertissement', () => {
  const p = plan('Daily', 50000);
  assert.ok(!('priceAmbiguous' in p));
  assert.ok(!('variants' in p));
});

test('programsFrom : Bolt et Direct sont des comptes finances direct', () => {
  assert.equal(famille('Instant Funding Bolt').type, 'instant');
  assert.equal(famille('Instant Funding Direct').type, 'instant');
  assert.equal(famille('Daily').type, 'eval');
  for (const p of programs) assert.equal(p.priceType, 'one-time');
});

test('programsFrom : aucune valeur null, sauf maxPayout qui dit « pas de plafond »', () => {
  const nulls = [];
  const walk = (o, path) => {
    for (const [k, v] of Object.entries(o)) {
      if (v === null) nulls.push(`${path}.${k}`);
      else if (v && typeof v === 'object') walk(v, `${path}.${k}`);
    }
  };
  programs.forEach((p) => walk(p, p.name));
  assert.ok(nulls.length, 'les Ultra n ont pas de plafond de payout, il doit etre explicite');
  for (const n of nulls) assert.ok(n.endsWith('.maxPayout'), n);
  assert.equal(plan('Daily Ultra (35%)', 50000).maxPayout, null);
  assert.equal(plan('Daily Max', 50000).maxPayout, 2500);
});

test('programsFrom : la forme du dataset, pour que rien en aval ne change', () => {
  const p = plan('Daily Max', 50000);
  assert.equal(p.ddType, 'EOD Trailing');
  assert.equal(p.maxDrawdown, 2000);
  assert.equal(p.profitTarget, 3000);
  assert.equal(p.originalPrice, 290);
  assert.equal(p.consistency, '35%');
  assert.equal(p.contracts, '4 minis');
  assert.equal(p.minPayout, 2000);
  assert.equal(p.resetFee, 150);
  // Un Instant n a pas d objectif : la cle n existe pas, elle ne vaut pas null.
  assert.ok(!('profitTarget' in plan('Instant Funding Bolt', 100000)));
});

test('programsFrom : une ligne inactive ne se vend pas', () => {
  const off = payload.map((r) => (r.name.includes('Daily Max') ? { ...r, active: false } : r));
  assert.ok(!programsFrom(off).some((p) => p.name === 'Daily Max'));
});

test('programsFrom : deux noms differents dans la meme famille, on refuse de melanger', () => {
  // Le jour ou ils laisseraient tomber le « (35%) » sur une seule des deux
  // lignes, « 1 Step Daily - 25K » et « 1 Step Daily (35%) - 25K » tomberaient
  // dans la meme famille. On s arrete plutot que de publier le prix de l autre.
  const collision = [...payload, { ...payload[0], id: 9999, name: '1 Step Daily - 25K' }];
  assert.throws(() => programsFrom(collision), /refus de les melanger/);
});

test('programsFrom : une famille inconnue de l ordre passe a la fin, jamais a la poubelle', () => {
  const nouveau = [...payload, { ...payload[0], id: 9998, name: '1 Step Turbo - 25K' }];
  const noms = programsFrom(nouveau).map((p) => p.name);
  assert.equal(noms.at(-1), 'Turbo');
  assert.equal(noms.length, 8);
});

test('programsFrom : un nom qui contredit account_size arrete tout', () => {
  const faux = payload.map((r) => (r.id === 1052 ? { ...r, account_size: 75000 } : r));
  assert.throws(() => programsFrom(faux), /leur nommage a change/);
});

test('programsFrom : un tableau vide se plaint au lieu de rendre zero programme', () => {
  assert.throws(() => programsFrom([]), /tableau vide/);
  assert.throws(() => programsFrom(null), /tableau vide/);
});

test('fetchFundedSeatPrograms : lit l API et rend les programmes', async () => {
  let vu = null;
  const fetchImpl = async (url) => {
    vu = url;
    return { ok: true, json: async () => payload };
  };
  const progs = await fetchFundedSeatPrograms({ fetchImpl });
  assert.equal(vu, FUNDEDSEAT_API);
  assert.equal(progs.length, 7);
});

test('fetchFundedSeatPrograms : une panne se dit clairement, elle ne se devine pas', async () => {
  await assert.rejects(
    fetchFundedSeatPrograms({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );
  await assert.rejects(
    fetchFundedSeatPrograms({
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
    }),
    /injoignable/,
  );
  await assert.rejects(
    fetchFundedSeatPrograms({ fetchImpl: async () => ({ ok: true, json: async () => [] }) }),
    /tableau vide/,
  );
});
