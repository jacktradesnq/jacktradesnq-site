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
 * readTradersLaunchPage (Chrome headless) : onglets Premium (60 / 80 %), Static
 * (60 / 80 / 90 %, avec sa FAQ) et Early Access (aucun drop en vente), plus les
 * Legacy NYC (55 / 80 %).
 */
const SNAP = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-pricing-2026-10-21.json'), 'utf8'),
);
const clone = () => structuredClone(SNAP);
const view = (s, account) => s.views.find((v) => v.account === account);
const at = (v, split) => v.splits.find((x) => x.split === split);

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

test('programsFromSnapshot : chaque programme porte ses horaires', () => {
  for (const p of programme('Legacy NYC').plans) {
    assert.equal(p.note, 'Trading hours: 9:30am – 4:00pm ET (Legacy NYC). Price shown for the 80% split.');
  }
  for (const name of ['Premium', 'Static']) {
    for (const p of programme(name).plans) {
      assert.equal(p.note, 'Trading hours: 6:00pm – 4:00pm ET the following day. Price shown for the 80% split.');
    }
  }
});

test('programsFromSnapshot : les prix des autres splits (60 %, 90 % Static, 55 % Legacy)', () => {
  assert.deepEqual(programme('Premium').plans.map((x) => x.splitPrices), [{ 60: 99 }, { 60: 199 }, { 60: 399 }]);
  assert.deepEqual(programme('Static').plans.map((x) => x.splitPrices), [
    { 60: 119, 90: 169 },
    { 60: 239, 90: 339 },
    { 60: 479, 90: 679 },
  ]);
  assert.deepEqual(programme('Legacy NYC').plans.map((x) => x.splitPrices), [{ 55: 49 }, { 55: 74 }, { 55: 139 }]);
  // Les cles sont dans l'ordre des splits, pour un JSON stable.
  assert.deepEqual(Object.keys(plan('Static', 25000).splitPrices), ['60', '90']);
});

test('programsFromSnapshot : « Days to Pass » lu la ou la carte le publie', () => {
  for (const name of ['Premium', 'Legacy NYC']) for (const p of programme(name).plans) assert.equal(p.minDays, 3);
  for (const p of programme('Static').plans) assert.ok(!('minDays' in p));
  const s = clone();
  const c = at(view(s, 'Premium'), 80).cards[0];
  c.text = c.text.replace('3 minimum', 'a few');
  assert.throws(() => programsFromSnapshot(s), /Days to Pass » illisible/);
});

test('programsFromSnapshot : un split dont les regles different arrete tout', () => {
  const s = clone();
  const c = at(view(s, 'Static'), 90).cards[0];
  c.text = c.text.replace('$1,500', '$1,750');
  assert.throws(() => programsFromSnapshot(s), /n'a pas les memes regles d'evaluation/);
});

test('programsFromSnapshot : un split propose sans carte arrete tout (pas de ligne de prix perdue en silence)', () => {
  const s = clone();
  at(view(s, 'Static'), 90).cards = [];
  assert.throws(() => programsFromSnapshot(s), /aucune carte au split 90 %/);
});

test('programsFromSnapshot : pas de perte journaliere, meme sans FAQ Static lue (regles du site)', () => {
  const s = clone();
  view(s, 'Static').faq = null;
  assert.ok(programsFromSnapshot(s).every((p) => p.plans.every((x) => x.dailyLoss === null)));
});

test('programsFromSnapshot : aucune regle inventee, aucune valeur nulle', () => {
  for (const p of programs) {
    assert.equal(p.type, 'eval');
    assert.equal(p.priceType, 'one-time');
    for (const x of p.plans) {
      for (const k of ['dailyLossSoft', 'activationFee', 'originalPrice']) {
        assert.ok(!(k in x), `${k} invente sur ${p.name} ${x.size}`);
      }
      // Pas de perte journaliere chez eux (traderslaunch.com/futures/rules, 21/10/2026).
      assert.equal(x.dailyLoss, null, `${p.name} ${x.size} : dailyLoss`);
      for (const [k, v] of Object.entries(x)) {
        if (k !== 'dailyLoss') assert.notEqual(v, null, `${p.name} ${x.size} : ${k} est null`);
      }
    }
  }
});

test('programsFromSnapshot : chaque texte publie se retrouve dans la carte lue', () => {
  const all = [...SNAP.views, SNAP.legacy]
    .flatMap((v) => v.splits.flatMap((x) => x.cards))
    .map((c) => c.text)
    .join('\n');
  for (const p of programs) {
    for (const x of p.plans) assert.ok(all.includes(x.contracts), `contracts absent : ${x.contracts}`);
  }
});

/**
 * Un drop Early Access fabrique (aucun n'est en vente le 21/10/2026) : deux
 * cartes au gabarit des cartes Static, sans selecteur de split, 80 % sur le lien.
 */
function withDrop(s) {
  const src = at(view(s, 'Static'), 80).cards.slice(0, 2);
  view(s, 'Early Access').splits = [
    {
      split: null,
      cards: src.map((c) => ({
        href: c.href.replace(/&planId=[^&]+/, '&planId=drop02'),
        text: c.text.replace(/\$149\n/, '$99\n').replace(/\$299\n/, '$199\n'),
      })),
    },
  ];
  return s;
}

test('Early Access : sans drop en vente, rien ne s ajoute', () => {
  assert.equal(earlyAccessStatus(SNAP), 'Early Access : aucun drop en vente');
  assert.ok(!programs.some((p) => p.name === 'Early Access'));
});

test('Early Access : un drop en vente devient un programme du site', () => {
  const s = withDrop(clone());
  assert.match(earlyAccessStatus(s), /2 carte\(s\) en vente, publiees/);
  const progs = programsFromSnapshot(s);
  assert.deepEqual(progs.map((p) => p.name), ['Premium', 'Static', 'Early Access', 'Legacy NYC']);
  const ea = progs.find((p) => p.name === 'Early Access');
  assert.deepEqual(
    ea.plans.map(({ size, price, profitTarget, maxDrawdown }) => ({ size, price, profitTarget, maxDrawdown })),
    [
      { size: 25000, price: 99, profitTarget: 1500, maxDrawdown: 500 },
      { size: 50000, price: 199, profitTarget: 3000, maxDrawdown: 1000 },
    ],
  );
  assert.equal(ea.type, 'eval');
  assert.equal(ea.priceType, 'one-time');
});

test('Early Access : un drop illisible est signale sans geler les autres programmes', () => {
  const s = withDrop(clone());
  view(s, 'Early Access').splits[0].cards[0].text = 'Drop 02\nbientot';
  const logs = [];
  const progs = programsFromSnapshot(s, { log: (l) => logs.push(l) });
  assert.deepEqual(progs.map((p) => p.name), ['Premium', 'Static', 'Legacy NYC']);
  assert.match(logs[0], /Early Access : drop en vente mais illisible, NON publie/);
});

test('programsFromSnapshot : un onglet vendu sans carte arrete tout (Static ne disparait pas en silence)', () => {
  const s = clone();
  view(s, 'Static').splits = [];
  assert.throws(() => programsFromSnapshot(s), /Static : aucune carte de prix/);
  assert.throws(() => programsFromSnapshot({ views: [] }), /aucun onglet/);
  assert.throws(() => programsFromSnapshot(null), /aucun onglet/);
});

test('programsFromSnapshot : une carte sans « One-Time Fee » se plaint au lieu d inventer', () => {
  const s = clone();
  const c = at(view(s, 'Premium'), 80).cards[0];
  c.text = c.text.replace('One-Time Fee', 'Tarif');
  assert.throws(() => programsFromSnapshot(s), /aucun prix « One-Time Fee »/);
});

test('programsFromSnapshot : un titre ou un capital qui contredit le lien arrete tout', () => {
  const s = clone();
  const c = at(view(s, 'Static'), 80).cards[0];
  c.text = c.text.replace('Static 25K', 'Static 50K');
  assert.throws(() => programsFromSnapshot(s), /ne parlent pas du meme compte/);

  const s2 = clone();
  const c2 = at(view(s2, 'Premium'), 80).cards[0];
  c2.text = c2.text.replace('$100,000 starting capital', '$250,000 starting capital');
  assert.throws(() => programsFromSnapshot(s2), /ne parlent pas du meme compte/);
});

test('programsFromSnapshot : un split qui contredit la carte ou l onglet arrete tout', () => {
  const s = clone();
  const c = at(view(s, 'Static'), 80).cards[1];
  c.href = c.href.replace('split=80', 'split=60');
  assert.throws(() => programsFromSnapshot(s), /split incoherent/);

  const s2 = clone();
  view(s2, 'Static').splits = view(s2, 'Static').splits.filter((x) => x.split !== 80);
  assert.throws(() => programsFromSnapshot(s2), /le split 80 % n'a pas pu etre choisi/);
});

test('programsFromSnapshot : un badge Legacy sans horaires restreintes arrete tout', () => {
  const s = clone();
  const c = at(s.legacy, 80).cards[0];
  c.href = c.href.replace('hours=1', 'hours=2');
  assert.throws(() => programsFromSnapshot(s), /se contredisent sur le produit vendu/);
});

test('programsFromSnapshot : un drawdown a la formulation inconnue arrete tout', () => {
  const s = clone();
  const c = at(view(s, 'Static'), 80).cards[0];
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
