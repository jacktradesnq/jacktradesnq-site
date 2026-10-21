import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRADERSLAUNCH_SOURCE,
  earlyAccessStatus,
  fetchTradersLaunchPrograms,
  programsFromSnapshot,
} from './lib/firms/traderslaunch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * La section #pricing de traderslaunch.com relevee le 2026-10-21 par
 * readTradersLaunchPage (Chrome headless) : onglets Premium, Static (split 80 %)
 * et Early Access (aucun drop en vente), plus les Legacy NYC.
 */
const SNAP = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-pricing-2026-10-21.json'), 'utf8'),
);
const clone = () => structuredClone(SNAP);
const view = (s, account) => s.views.find((v) => v.account === account);

const programs = programsFromSnapshot(SNAP);
const programme = (name) => programs.find((p) => p.name === name);
const plan = (name, size) => programme(name)?.plans.find((p) => p.size === size);

test('programsFromSnapshot : Premium, Static et Legacy NYC, Early Access non publie', () => {
  assert.deepEqual(
    programs.map((p) => p.name),
    ['Premium', 'Static', 'Legacy NYC'],
  );
});

test('programsFromSnapshot : les tailles de chaque programme, triees', () => {
  assert.deepEqual(programme('Premium').plans.map((x) => x.size), [100000, 200000, 300000]);
  assert.deepEqual(programme('Static').plans.map((x) => x.size), [25000, 50000, 100000]);
  assert.deepEqual(programme('Legacy NYC').plans.map((x) => x.size), [100000, 200000, 300000]);
});

test('programsFromSnapshot : les prix exacts (split 80 %)', () => {
  assert.deepEqual(programme('Premium').plans.map((x) => x.price), [159, 299, 599]);
  assert.deepEqual(programme('Static').plans.map((x) => x.price), [149, 299, 599]);
  assert.deepEqual(programme('Legacy NYC').plans.map((x) => x.price), [99, 149, 279]);
});

test('programsFromSnapshot : les regles du Static, drawdown statique', () => {
  assert.deepEqual(
    programme('Static').plans.map(({ profitTarget, maxDrawdown, ddType, consistency, contracts }) => ({
      profitTarget,
      maxDrawdown,
      ddType,
      consistency,
      contracts,
    })),
    [
      { profitTarget: 1500, maxDrawdown: 500, ddType: 'static - Does not trail', consistency: '50%', contracts: '1 mini or 10 micros' },
      { profitTarget: 3000, maxDrawdown: 1000, ddType: 'static - Does not trail', consistency: '50%', contracts: '2 minis or 20 micros' },
      { profitTarget: 6000, maxDrawdown: 2000, ddType: 'static - Does not trail', consistency: '50%', contracts: '4 minis or 40 micros' },
    ],
  );
});

test('programsFromSnapshot : les regles de Premium et des Legacy', () => {
  const p = plan('Premium', 200000);
  assert.equal(p.profitTarget, 4000);
  assert.equal(p.maxDrawdown, 2000);
  assert.equal(p.ddType, 'EOD - Locks at starting balance');
  assert.equal(p.consistency, '40%');
  assert.equal(p.contracts, '4 minis or 40 micros');

  // Les Legacy ne sont pas un Premium moins cher : objectifs et tailles de depart differents.
  const l = plan('Legacy NYC', 200000);
  assert.equal(l.profitTarget, 3000);
  assert.equal(l.maxDrawdown, 1000);
  assert.equal(l.ddType, 'EOD - Locks at starting balance');
  assert.equal(l.contracts, '1 mini or 10 micros');
  assert.equal(plan('Legacy NYC', 100000).contracts, '5 micros');
});

test('programsFromSnapshot : Legacy NYC porte ses horaires, les autres non', () => {
  for (const p of programme('Legacy NYC').plans) {
    assert.equal(p.note, 'Trading hours: 9:30am – 4:00pm ET (Legacy NYC). Price shown for the 80% split.');
  }
  for (const name of ['Premium', 'Static']) {
    for (const p of programme(name).plans) assert.equal(p.note, 'Price shown for the 80% split.');
  }
});

test('programsFromSnapshot : aucune regle inventee, aucune valeur nulle', () => {
  for (const p of programs) {
    assert.equal(p.type, 'eval');
    assert.equal(p.priceType, 'one-time');
    for (const x of p.plans) {
      for (const k of ['dailyLoss', 'dailyLossSoft', 'activationFee', 'originalPrice']) {
        assert.ok(!(k in x), `${k} invente sur ${p.name} ${x.size}`);
      }
      for (const [k, v] of Object.entries(x)) assert.notEqual(v, null, `${p.name} ${x.size} : ${k} est null`);
    }
  }
});

test('programsFromSnapshot : chaque texte publie se retrouve dans la carte lue', () => {
  const all = [...SNAP.views.flatMap((v) => v.cards), ...SNAP.legacy.cards].map((c) => c.text).join('\n');
  for (const p of programs) {
    for (const x of p.plans) assert.ok(all.includes(x.contracts), `contracts absent : ${x.contracts}`);
  }
});

test('earlyAccessStatus : le journal dit s il y a un drop en vente', () => {
  assert.equal(earlyAccessStatus(SNAP), 'Early Access : aucun drop en vente');
  const s = clone();
  view(s, 'Early Access').cards = view(s, 'Static').cards;
  assert.match(earlyAccessStatus(s), /3 carte\(s\) en vente, NON publiees/);
  // ... et un drop en vente ne s'invite pas sur le site.
  assert.ok(!programsFromSnapshot(s).some((p) => p.name === 'Early Access'));
});

test('programsFromSnapshot : un onglet vendu sans carte arrete tout (Static ne disparait pas en silence)', () => {
  const s = clone();
  view(s, 'Static').cards = [];
  assert.throws(() => programsFromSnapshot(s), /Static : aucune carte de prix/);
  assert.throws(() => programsFromSnapshot({ views: [] }), /aucun onglet/);
  assert.throws(() => programsFromSnapshot(null), /aucun onglet/);
});

test('programsFromSnapshot : une carte sans « One-Time Fee » se plaint au lieu d inventer', () => {
  const s = clone();
  const c = view(s, 'Premium').cards[0];
  c.text = c.text.replace('One-Time Fee', 'Tarif');
  assert.throws(() => programsFromSnapshot(s), /aucun prix « One-Time Fee »/);
});

test('programsFromSnapshot : un titre ou un capital qui contredit le lien arrete tout', () => {
  const s = clone();
  const c = view(s, 'Static').cards[0];
  c.text = c.text.replace('Static 25K', 'Static 50K');
  assert.throws(() => programsFromSnapshot(s), /ne parlent pas du meme compte/);

  const s2 = clone();
  const c2 = view(s2, 'Premium').cards[0];
  c2.text = c2.text.replace('$100,000 starting capital', '$250,000 starting capital');
  assert.throws(() => programsFromSnapshot(s2), /ne parlent pas du meme compte/);
});

test('programsFromSnapshot : un split qui contredit la carte ou l onglet arrete tout', () => {
  const s = clone();
  view(s, 'Static').cards[1].href = view(s, 'Static').cards[1].href.replace('split=80', 'split=60');
  assert.throws(() => programsFromSnapshot(s), /split incoherent/);

  const s2 = clone();
  view(s2, 'Static').split = 60;
  assert.throws(() => programsFromSnapshot(s2), /le split 80 % n'a pas pu etre choisi/);
});

test('programsFromSnapshot : un badge Legacy sans horaires restreintes arrete tout', () => {
  const s = clone();
  s.legacy.cards[0].href = s.legacy.cards[0].href.replace('hours=1', 'hours=2');
  assert.throws(() => programsFromSnapshot(s), /se contredisent sur le produit vendu/);
});

test('programsFromSnapshot : un drawdown a la formulation inconnue arrete tout', () => {
  const s = clone();
  const c = view(s, 'Static').cards[0];
  c.text = c.text.replace('$500 staticDoes not trail', 'Five hundred, trailing');
  assert.throws(() => programsFromSnapshot(s), /drawdown illisible/);
});

test('fetchTradersLaunchPrograms : lit le releve, journalise Early Access', async () => {
  const logs = [];
  const progs = await fetchTradersLaunchPrograms({ read: async () => SNAP, log: (l) => logs.push(l) });
  assert.equal(progs.length, 3);
  assert.equal(progs[1].plans[0].price, 149);
  assert.deepEqual(logs, ['Early Access : aucun drop en vente']);
  assert.equal(TRADERSLAUNCH_SOURCE, 'page traderslaunch.com');
});

test('fetchTradersLaunchPrograms : une panne de lecture remonte telle quelle', async () => {
  await assert.rejects(
    fetchTradersLaunchPrograms({
      read: async () => {
        throw new Error('https://traderslaunch.com/ : HTTP 503');
      },
    }),
    /HTTP 503/,
  );
});
