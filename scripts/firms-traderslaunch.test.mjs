import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRADERSLAUNCH_SOURCE,
  accountLabels,
  bannerSaleOnAllAccounts,
  checkSaleCoherence,
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

test('programsFromSnapshot : cartes du 04/11/2026, « Session Profit Limit », « No minimum », limite fixe', () => {
  const s = clone();
  const c = at(view(s, 'Premium'), 80).cards[0];
  c.text = c.text
    .replace('3 minimum', 'No minimum')
    .replace(/Best Day\n[^\n]*/, 'Session Profit Limit\n40% of profit target')
    .replace(/Starts at (\d+ minis? or \d+ micros?)[^.]*\./, 'Starts at $1; that is your fixed limit.');
  assert.match(c.text, /Session Profit Limit/);
  assert.match(c.text, /fixed limit/);
  const p = programsFromSnapshot(s).find((x) => x.name === 'Premium').plans[0];
  assert.equal(p.minDays, 0);
  assert.equal(p.consistency, '40%');
  assert.equal(p.ddType, 'EOD - Locks at starting balance');
  assert.match(p.contracts, /^\d+ minis? or \d+ micros?$/);
  assert.match(p.note, /^Session profit limit: 40% of profit target\. /);
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
  assert.ok(!programs.some((p) => p.name === 'Drop'));
});

test('Early Access : un drop en vente devient un programme du site', () => {
  const s = withDrop(clone());
  assert.match(earlyAccessStatus(s), /2 carte\(s\) en vente, publiees/);
  const progs = programsFromSnapshot(s);
  assert.deepEqual(progs.map((p) => p.name), ['Premium', 'Static', 'Drop', 'Legacy NYC']);
  const ea = progs.find((p) => p.name === 'Drop');
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
  assert.deepEqual(logs, [
    'Early Access : aucun drop en vente',
    'bannière sans remise sur tous les comptes (ou illisible) : pas de recoupement',
  ]);
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

/**
 * La page relevee le 2026-10-26 : TL Drop #2 en vente sur Hyperprop seulement.
 * Sur la plateforme par defaut, l'onglet Early Access n'a aucune carte, seulement
 * « Show Hyperprop Accounts » ; la lecture clique ce bouton. Ses trois cartes
 * (25K, 60 / 80 / 90 %) s'affichent ensemble, sans selecteur de split.
 */
const SNAP_DROP2 = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-pricing-2026-10-26.json'), 'utf8'),
);

test('TL Drop #2 (Hyperprop only) : publie comme programme Early Access', () => {
  assert.equal(
    earlyAccessStatus(SNAP_DROP2),
    'Early Access : 3 carte(s) en vente sur Hyperprop, publiees comme programme « Drop »',
  );
  const progs = programsFromSnapshot(SNAP_DROP2);
  assert.deepEqual(progs.map((p) => p.name), ['Premium', 'Static', 'Drop', 'Legacy NYC']);
  const [p] = progs.find((x) => x.name === 'Drop').plans;
  assert.deepEqual(
    {
      size: p.size,
      price: p.price,
      originalPrice: p.originalPrice,
      splitPrices: p.splitPrices,
      profitTarget: p.profitTarget,
      maxDrawdown: p.maxDrawdown,
      ddType: p.ddType,
      dailyLoss: p.dailyLoss,
      consistency: p.consistency,
      contracts: p.contracts,
    },
    {
      size: 25000,
      price: 79.2,
      originalPrice: 99,
      splitPrices: { 60: 63.2, 90: 95.2 },
      profitTarget: 1200,
      maxDrawdown: 1000,
      ddType: 'EOD - Stops trailing at $25,000',
      dailyLoss: 600,
      consistency: 'None',
      contracts: '1 mini or 10 micros',
    },
  );
  assert.equal(p.minDays, 0); // « Minimum Days None »
  assert.equal(
    p.note,
    'TL Drop #2 · Hyperprop only. Ends Mon, Nov 2, 6:53 AM ET. ' +
      'Daily loss limit lifted on days that start at or above $25,600. Price shown for the 80% split.',
  );
});

test('TL Drop #2 : les autres programmes gardent leur lecture (pas de perte journaliere, pas de prix barre)', () => {
  const progs = programsFromSnapshot(SNAP_DROP2);
  for (const pr of progs.filter((x) => x.name !== 'Drop')) {
    for (const p of pr.plans) {
      assert.equal(p.dailyLoss, null, `${pr.name} ${p.size}`);
      assert.equal(p.originalPrice, undefined, `${pr.name} ${p.size}`);
    }
  }
});

/**
 * La page relevee le 2026-11-19 (lecteur corrige) : onglets Premium, Static et
 * « TL Drops » (l'ancien Early Access), un choix de plateforme Volumetrica / Hyperprop
 * au-dessus, plus aucune carte Legacy NYC dans #pricing (plus de bouton
 * « View Legacy Accounts », plus de lien hours=1).
 */
const SNAP_1119 = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-pricing-2026-11-19.json'), 'utf8'),
);

test('accountLabels : le logo de plateforme « Selected » n est pas un onglet (boutons du 19/11/2026)', () => {
  // Les boutons aria-pressed de #pricing tels que la page les rend le 19/11/2026.
  const buttons = [
    { text: 'Selected', logo: true }, // logo Volumetrica, choisi
    { text: '', logo: true }, // logo Hyperprop
    { text: 'Premium\nEOD', logo: false },
    { text: 'Static\nNo Buffer', logo: false },
    { text: 'TL Drops\nOn Sale Now', logo: false },
    { text: '60%', logo: false },
    { text: '80%', logo: false },
  ];
  assert.deepEqual(accountLabels(buttons), ['Premium', 'Static', 'TL Drops']);
  assert.deepEqual(accountLabels(null), []);
});

test('programsFromSnapshot (19/11/2026) : Premium et Static, aucun « Selected », « TL Drops » lu comme les drops', () => {
  const logs = [];
  const progs = programsFromSnapshot(SNAP_1119, { log: (l) => logs.push(l) });
  const names = progs.map((p) => p.name);
  assert.ok(names.includes('Premium') && names.includes('Static'), names.join(', '));
  assert.ok(!names.includes('Selected') && !names.includes('TL Drops'), names.join(', '));
  assert.deepEqual(
    progs.find((p) => p.name === 'Premium').plans.map((p) => [p.size, p.price, p.splitPrices]),
    [
      [100000, 159, { 60: 99 }],
      [200000, 299, { 60: 199 }],
      [300000, 599, { 60: 399 }],
    ],
  );
  assert.equal(earlyAccessStatus(SNAP_1119), 'TL Drops : 3 carte(s) en vente, publiees comme programme « Drop »');
});

test('programsFromSnapshot : deux onglets aux memes cartes arretent tout (le « Selected » du 05/11/2026)', () => {
  const s = structuredClone(SNAP_1119);
  // Ce que lisait l'ancien lecteur : le logo « Selected », deja choisi, relu comme un onglet.
  s.views.unshift({ ...structuredClone(view(s, 'Premium')), account: 'Selected' });
  assert.throws(() => programsFromSnapshot(s), /« Selected » et « Premium » montrent les memes cartes/);
});

test('TL Drops (19/11/2026) : le drop Rapid 25K publie tel que ses cartes l ecrivent', () => {
  const logs = [];
  const progs = programsFromSnapshot(SNAP_1119, { log: (l) => logs.push(l) });
  assert.deepEqual(logs, []);
  assert.deepEqual(progs.map((p) => p.name), ['Premium', 'Static', 'Drop']);
  const [p] = progs.find((x) => x.name === 'Drop').plans;
  // Cartes : « $89 » (80 %) / « List price $111.25 », « $59 » (60 %), « $109 » (90 %),
  // « Profit Target $1,250 », « $500 EOD trailingStops trailing at $25,000 »,
  // « Daily Loss Limit None », « Consistency Rule None »,
  // « Contract Limit 10 micros total; no minisVolumetrica's platform limits ... ».
  assert.deepEqual(p, {
    size: 25000,
    price: 89,
    originalPrice: 111.25,
    profitTarget: 1250,
    maxDrawdown: 500,
    ddType: 'EOD - Stops trailing at $25,000',
    consistency: 'None',
    dailyLoss: null,
    contracts: '10 micros total; no minis',
    minDays: 0,
    note: 'Rapid. Price shown for the 80% split.',
    splitPrices: { 60: 59, 90: 109 },
  });
});

test('Contract Limit : la valeur sans l explication collee, une valeur sans unite n est pas devinee', () => {
  const s = structuredClone(SNAP_1119);
  for (const c of view(s, 'TL Drops').splits[0].cards) {
    c.text = c.text.replace(/Contract Limit\n[^\n]*/, 'Contract Limit\nask support');
  }
  const [p] = programsFromSnapshot(s).find((x) => x.name === 'Drop').plans;
  assert.equal('contracts' in p, false);
});

/**
 * La page relevee le 28/11/2026 a 00:13 heure de Paris (27/11 23:13 UTC ; Black Friday « 30% Off All Accounts »,
 * code TL30, jusqu'au 2026-12-01 04:59 UTC selon leur /api/promo-banner) : chaque carte
 * affiche son prix remise, puis « List price » et « 30% Off ». Premium compris : la
 * synchro du 27/11 a 16:41 UTC l'avait lu sans prix barre (159 / 299 / 599).
 */
const SNAP_1128 = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-pricing-2026-11-28.json'), 'utf8'),
);

test('programsFromSnapshot (28/11/2026) : Premium remise de 30 %, lu avec son prix barre', () => {
  const progs = programsFromSnapshot(SNAP_1128);
  assert.deepEqual(progs.map((p) => p.name), ['Premium', 'Static', 'Drop']);
  const table = (name) => progs.find((p) => p.name === name).plans.map((p) => [p.size, p.price, p.originalPrice, p.splitPrices]);
  assert.deepEqual(table('Premium'), [
    [100000, 111.3, 159, { 60: 69.3 }],
    [200000, 209.3, 299, { 60: 139.3 }],
    [300000, 419.3, 599, { 60: 279.3 }],
  ]);
  assert.deepEqual(table('Static'), [
    [25000, 104.3, 149, { 60: 83.3, 90: 118.3 }],
    [50000, 209.3, 299, { 60: 167.3, 90: 237.3 }],
    [100000, 419.3, 599, { 60: 335.3, 90: 475.3 }],
  ]);
  const [drop] = progs.find((p) => p.name === 'Drop').plans;
  assert.deepEqual([drop.price, drop.originalPrice, drop.splitPrices, drop.contracts, drop.minDays], [
    77.88,
    111.25,
    { 60: 51.63, 90: 95.38 },
    '10 micros total; no minis',
    0,
  ]);
});

test('Minimum Days : un texte qui n est ni « None » ni un nombre de jours arrete le drop', () => {
  const s = structuredClone(SNAP_1119);
  for (const c of view(s, 'TL Drops').splits[0].cards) c.text = c.text.replace('Minimum Days\nNone', 'Minimum Days\nask support');
  const logs = [];
  const progs = programsFromSnapshot(s, { log: (l) => logs.push(l) });
  assert.ok(!progs.some((p) => p.name === 'Drop'));
  assert.match(logs[0], /« Minimum Days » illisible/);
  const ok = structuredClone(SNAP_1119);
  for (const c of view(ok, 'TL Drops').splits[0].cards) c.text = c.text.replace('Minimum Days\nNone', 'Minimum Days\n3 days');
  assert.equal(programsFromSnapshot(ok).find((p) => p.name === 'Drop').plans[0].minDays, 3);
});

/* ------- garde-fou du 27/11/2026 : bannière « X% Off All Accounts » contre cartes sans prix barre ------- */

/**
 * La reponse de /api/promo-banner relue le 27/11/2026 vers 23:15 UTC, quelques minutes apres le
 * releve SNAP_1128 : « 30% Off All Accounts », code TL30, public « everyone », fin 2026-12-01T04:59Z.
 */
const BANNER_1128 = JSON.parse(
  fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'traderslaunch-promo-banner-2026-11-28.json'), 'utf8'),
);
const withBanner = (snap, banner = { status: BANNER_1128.status, body: BANNER_1128.body }) => ({
  ...structuredClone(snap),
  banner,
});
/** Ce que la synchro du 27/11 a 16:41 UTC a lu : les cartes Premium sans « List price ». */
const premiumAtFullPrice = (snap) => {
  for (const sp of view(snap, 'Premium').splits) {
    for (const c of sp.cards) {
      const list = /List price\n(\$[\d,.]+)\n\d+% Off\n/.exec(c.text);
      c.text = c.text.replace(/\$[\d,.]+\n\nOne-Time Fee/, `${list[1]}\n\nOne-Time Fee`).replace(list[0], '');
    }
  }
  return snap;
};

test('bannière du 28/11/2026 : 30 % sur tous les comptes, en cours', () => {
  assert.deepEqual(bannerSaleOnAllAccounts(BANNER_1128, '2026-11-27T23:13:57.562Z'), {
    percent: 30,
    message: '30% Off All Accounts',
    expiresAt: '2026-12-01T04:59:00Z',
  });
});

test('bannière : illisible, absente, eteinte, expiree, public restreint ou autre message = pas de recoupement', () => {
  const at = '2026-11-27T23:13:57.562Z';
  const payload = JSON.parse(JSON.parse(BANNER_1128.body).payload);
  const body = (p) => JSON.stringify({ flagValue: 'x', payload: JSON.stringify({ ...payload, ...p }) });
  assert.equal(bannerSaleOnAllAccounts(null, at), null);
  assert.equal(bannerSaleOnAllAccounts({ status: 0, error: 'TypeError: Failed to fetch' }, at), null);
  assert.equal(bannerSaleOnAllAccounts({ status: 500, body: BANNER_1128.body }, at), null);
  assert.equal(bannerSaleOnAllAccounts({ status: 200, body: '<html>' }, at), null);
  assert.equal(bannerSaleOnAllAccounts({ status: 200, body: body({ enabled: false }) }, at), null);
  assert.equal(bannerSaleOnAllAccounts({ status: 200, body: body({ audience: 'new-traders' }) }, at), null);
  assert.equal(bannerSaleOnAllAccounts({ status: 200, body: body({ message: '30% Off Static Accounts' }) }, at), null);
  assert.equal(bannerSaleOnAllAccounts(BANNER_1128, '2026-12-01T05:00:00Z'), null);
  assert.equal(bannerSaleOnAllAccounts(BANNER_1128, 'pas une date'), null);
});

test('garde-fou : la page du 28/11/2026 est coherente, la lecture passe et le dit', async () => {
  const logs = [];
  const progs = await fetchTradersLaunchPrograms({ read: async () => withBanner(SNAP_1128), log: (l) => logs.push(l) });
  assert.equal(progs.find((p) => p.name === 'Premium').plans[0].price, 111.3);
  assert.ok(logs.includes('bannière « 30% Off All Accounts » : chaque carte a son prix barre'), logs.join(' | '));
});

test('garde-fou : Premium sans prix barre pendant « 30% Off All Accounts » = lecture refusee, job rouge', async () => {
  const snap = premiumAtFullPrice(withBanner(SNAP_1128));
  // Sans le garde-fou, le lecteur publiait le plein tarif (la synchro du 27/11 a 16:41 UTC).
  assert.deepEqual(
    programsFromSnapshot(snap).find((p) => p.name === 'Premium').plans.map((p) => [p.price, p.originalPrice]),
    [
      [159, undefined],
      [299, undefined],
      [599, undefined],
    ],
  );
  const err = await fetchTradersLaunchPrograms({ read: async () => snap }).then(
    () => null,
    (e) => e,
  );
  assert.ok(err, 'la lecture aurait du etre refusee');
  assert.equal(err.failJob, true);
  assert.match(err.message, /bannière « 30% Off All Accounts » jusqu'au 2026-12-01T04:59:00Z, mais 6 carte\(s\) sans prix barre/);
  assert.match(err.message, /Premium « Futures 100K » 80%/);
});

test('garde-fou : bannière illisible ou absente, la meme page passe (la bannière ne bloque jamais seule)', async () => {
  // undefined : un releve sans bannière (lu avant le 28/11/2026, ou par un autre chemin).
  for (const banner of [undefined, { status: 0, error: 'TypeError: Failed to fetch' }, { status: 200, body: 'oops' }]) {
    const snap = premiumAtFullPrice({ ...structuredClone(SNAP_1128), banner });
    assert.equal(checkSaleCoherence(snap), null);
    const progs = await fetchTradersLaunchPrograms({ read: async () => snap });
    assert.equal(progs.find((p) => p.name === 'Premium').plans[0].price, 159);
  }
});

test('Daily Loss Limit : un texte qui n est ni un montant ni « None » reste une erreur', () => {
  const s = structuredClone(SNAP_1119);
  const card = view(s, 'TL Drops').splits[0].cards[0];
  card.text = card.text.replace('Daily Loss Limit\nNone', 'Daily Loss Limit\nask support');
  const logs = [];
  const progs = programsFromSnapshot(s, { log: (l) => logs.push(l) });
  assert.ok(!progs.some((p) => p.name === 'Drop'));
  assert.match(logs[0], /TL Drops : drop en vente mais illisible, NON publie .*« Daily Loss Limit » illisible/);
});
