// Lecture du catalogue BluSky : l'API publique de leur checkout, recoupee par la page des plans
// de blusky.pro, sur les pages enregistrees le 2026-11-28 (et la liste du 2026-10-27). Pas de reseau.
// Run: node --test scripts/firms-blusky.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { guardCatalog, syncCatalog } from './lib/catalog-sync.mjs';
import { plansPageEntries, readBluSky, sizeOf } from './lib/firms/blusky.mjs';
import { scrapeBluSky } from './scrape-prop-firms.mjs';

const fixture = (name) => new URL(`./lib/firms/fixtures/${name}`, import.meta.url);
const PRODUCTS = JSON.parse(fs.readFileSync(fixture('blusky-products-2026-11-28.json'), 'utf8'));
const PLANS_PAGE = fs.readFileSync(fixture('blusky-plans-2026-11-28.html'), 'utf8');
const PRODUCTS_OCT = JSON.parse(fs.readFileSync(fixture('blusky-products-2026-10-27.json'), 'utf8'));
// Copie figée du JSON du site, pas le fichier vivant que le bot réécrit chaque jour : un prix légitime
// qui bouge ne doit pas bloquer la synchro avant sa lecture (Angelo, 19/11/2026 : « oui » à assouplir).
const DATA = JSON.parse(fs.readFileSync(fixture('prop-firms-snapshot-2026-11-19.json'), 'utf8'));

const firmJSON = () => structuredClone(DATA.firms.find((f) => f.id === 'blusky'));
const planOf = (programs, name, size) => programs.find((p) => p.name === name)?.plans.find((pl) => pl.size === size);
const prices = (programs) => programs.flatMap((p) => p.plans.map((pl) => [p.name, pl.size, pl.price, pl.originalPrice]));

const SOLD = [
  ['Launch', 50000, 49, 59],
  ['Launch', 100000, 59, 69],
  ['Launch', 200000, 69, 79],
  ['Propel', 25000, 105, 150],
  ['Propel', 50000, 112, 160],
  ['Propel', 100000, 154, 220],
  ['Propel', 150000, 119, 170],
  ['Propel', 200000, 189, 270],
  ['Propel', 300000, 224, 320],
  ['Orbit', 50000, 139.3, 199],
  ['Orbit', 100000, 209.3, 299],
  ['Orbit', 150000, 293.3, 419],
  ['Orbit', 200000, 293.3, 419],
  ['Direct 2 Funded', 3500, 599.2, 749],
  ['Instant Funded', 50000, 299, 599],
];

/** Un produit du checkout copie sous un autre nom, une autre taille, un autre prix. */
function productLike(product, { name, size, price }) {
  const p = structuredClone(product);
  p.name = name;
  for (const v of p.variants) {
    v.account_size = size;
    v.price = price;
  }
  return p;
}

/* ---------------- catalogue et prix ---------------- */

test('les 15 comptes vendus le 2026-11-28, prix avec JTNQ et prix catalogue', () => {
  assert.deepEqual(prices(readBluSky(PRODUCTS, PLANS_PAGE).programs), SOLD);
});

test('la liste du 2026-10-27 se lit toujours, aux memes prix', () => {
  assert.deepEqual(prices(readBluSky(PRODUCTS_OCT, PLANS_PAGE).programs), SOLD);
});

test('programmes : evaluation ou instant, prix au mois (abonnement) ou une fois', () => {
  const { programs } = readBluSky(PRODUCTS, PLANS_PAGE);
  assert.deepEqual(
    programs.map((p) => [p.name, p.type, p.priceType]),
    [
      ['Launch', 'eval', 'monthly'],
      ['Propel', 'eval', 'monthly'],
      ['Orbit', 'eval', 'one-time'],
      ['Direct 2 Funded', 'instant', 'one-time'],
      ['Instant Funded', 'instant', 'one-time'],
    ],
  );
});

test('frais d activation : ceux de « Activation Product » pour Launch, 0 la ou le checkout dit qu il n y en a pas', () => {
  const { programs } = readBluSky(PRODUCTS, PLANS_PAGE);
  assert.equal(planOf(programs, 'Launch', 50000).activationFee, 99);
  assert.equal(planOf(programs, 'Launch', 100000).activationFee, 149);
  assert.equal(planOf(programs, 'Launch', 200000).activationFee, 179);
  for (const p of programs.filter((x) => x.name !== 'Launch')) {
    for (const pl of p.plans) assert.equal(pl.activationFee, 0, `${p.name} ${pl.size}`);
  }
});

test('les frais de Launch (« No Type ») ne sont pas des comptes, ni un essai gratuit, ni un produit archive', () => {
  const list = structuredClone(PRODUCTS);
  list.find((g) => g.challenge_type === 'ORBIT').products[0].challenge.is_free_trial = true;
  list.find((g) => g.challenge_type === 'PROPEL').products[0].challenge.archived = true;
  const { programs, notes } = readBluSky(list, PLANS_PAGE);
  assert.ok(!programs.some((p) => p.name === 'No Type'));
  assert.equal(planOf(programs, 'Orbit', 50000), undefined);
  assert.equal(planOf(programs, 'Propel', 25000), undefined);
  assert.ok(notes.some((n) => /essai gratuit/.test(n)));
  assert.ok(notes.some((n) => /archive/.test(n)));
});

test('un prix qui change selon la plateforme arrete la firme', () => {
  const broken = structuredClone(PRODUCTS);
  broken[0].products[0].variants[1].price = '61';
  assert.throws(() => readBluSky(broken, PLANS_PAGE), /prix differents/);
});

test('des frais d activation dus sans prix arretent la firme', () => {
  const broken = structuredClone(PRODUCTS);
  const fees = broken.find((g) => g.challenge_type === 'No Type').products[0];
  fees.variants = fees.variants.filter((v) => v.account_size !== '50K');
  assert.throws(() => readBluSky(broken, PLANS_PAGE), /LAUNCH 50K: frais d'activation dus/);
});

test('tailles', () => {
  assert.equal(sizeOf('3.5K'), 3500);
  assert.equal(sizeOf('200K'), 200000);
  assert.throws(() => sizeOf('200K Static'));
});

/* ---------------- regles ---------------- */

test('les regles de la 1re phase du checkout, dans le vocabulaire du JSON', () => {
  const { programs } = readBluSky(PRODUCTS, PLANS_PAGE);
  const launch = planOf(programs, 'Launch', 50000);
  assert.deepEqual(
    {
      profitTarget: launch.profitTarget,
      maxDrawdown: launch.maxDrawdown,
      ddType: launch.ddType,
      dailyLoss: launch.dailyLoss,
      consistency: launch.consistency,
      minDays: launch.minDays,
      contracts: launch.contracts,
    },
    {
      profitTarget: 3000,
      maxDrawdown: 2000,
      ddType: 'EOD Trailing',
      dailyLoss: null, // help.blusky.pro : « Daily loss limit: None »
      consistency: '55%',
      minDays: 0,
      contracts: '5 minis or 50 micros',
    },
  );
  assert.equal(planOf(programs, 'Launch', 200000).ddType, 'Static');
  assert.equal(planOf(programs, 'Propel', 150000).contracts, undefined); // voir le test suivant
  // Orbit : « Orbit Evaluations have no consistency », au moins un jour.
  assert.equal(planOf(programs, 'Orbit', 100000).consistency, 'None');
  assert.equal(planOf(programs, 'Orbit', 100000).minDays, 1);
  // Les comptes instant : pas d'objectif, leur perte journaliere.
  const instant = planOf(programs, 'Instant Funded', 50000);
  assert.equal(instant.profitTarget, null);
  assert.equal(instant.ddType, 'Intraday');
  assert.equal(instant.dailyLoss, 1000);
  assert.equal(instant.consistency, '21%');
  const d2f = planOf(programs, 'Direct 2 Funded', 3500);
  assert.equal(d2f.maxDrawdown, 2500);
  assert.equal(d2f.ddType, 'Static');
  assert.equal(d2f.dailyLoss, 2000);
});

test('la page des plans de blusky.pro : les lignes de son tableau', () => {
  const entries = plansPageEntries(PLANS_PAGE);
  const propel = entries.filter((e) => e.mode === 'premium').map((e) => e.size);
  assert.deepEqual(propel, [25000, 50000, 100000, 150000, 200000, 300000]);
  const p25 = entries.find((e) => e.mode === 'premium' && e.size === 25000).args;
  assert.equal(p25.micMin, '4 Mini / 40 Micros');
  assert.equal(p25.discount, 'USE CODE: 30OFF');
  assert.deepEqual(
    entries.filter((e) => e.mode === 'instant').map((e) => e.size),
    [3500, 50000],
  );
});

test('la page des plans sans son tableau arrete la firme', () => {
  assert.throws(() => readBluSky(PRODUCTS, '<html><body>maintenance</body></html>'), /skyData/);
});

test('quand le checkout et blusky.pro se contredisent, la regle n est pas ecrite', () => {
  const { programs, notes, rules } = readBluSky(PRODUCTS, PLANS_PAGE);
  // Contrats Propel 25K / 150K : checkout 2/25 et 1/15, blusky.pro (et le help center) 4/40 et 1/10.
  assert.equal('contracts' in planOf(programs, 'Propel', 25000), false);
  assert.equal('contracts' in planOf(programs, 'Propel', 150000), false);
  // Propel 300K : checkout $20,001 / $5,001 (pourcentages arrondis), blusky.pro $20,000 / $5,000.
  const p300 = planOf(programs, 'Propel', 300000);
  assert.equal('profitTarget' in p300, false);
  assert.equal('maxDrawdown' in p300, false);
  // Sa perte journaliere du checkout ($20,001, plus grande que la perte max) n'est pas ecrite non plus.
  assert.equal('dailyLoss' in p300, false);
  assert.equal(p300.consistency, '55%'); // les deux pages disent 55 %
  assert.equal(notes.filter((n) => /se contredisent/.test(n)).length, 4);
  // Le controle des regles compare ce que lit un visiteur de blusky.pro.
  const r25 = rules.find((r) => r.programName === 'Propel' && r.size === 25000).rules;
  assert.equal(r25.contracts, '4 minis or 40 micros');
  const r300 = rules.find((r) => r.programName === 'Propel' && r.size === 300000).rules;
  assert.equal(r300.profitTarget, 20000);
  assert.equal(r300.maxDrawdown, 5000);
  assert.equal('dailyLoss' in r300, false);
});

test('une regle illisible au checkout est une cle absente, jamais devinee', () => {
  const list = structuredClone(PRODUCTS);
  // Direct 2 Funded : la page des plans ecrit « N/A » pour son drawdown, rien ne le recoupe.
  list.find((g) => g.challenge_type === 'Direct 2 Funded').products[0].challenge.phases[0].maximum_drawdown_amount = null;
  const { programs, rules } = readBluSky(list, PLANS_PAGE);
  assert.equal('maxDrawdown' in planOf(programs, 'Direct 2 Funded', 3500), false);
  const r = rules.find((x) => x.programName === 'Direct 2 Funded').rules;
  assert.equal(typeof r.maxDrawdown.broken, 'string');
});

/* ---------------- la synchro du catalogue ---------------- */

test('sur le JSON du site : aucun plan ajoute ni retire, prix identiques, regles ecrites a la main gardees', () => {
  const firm = firmJSON();
  const { programs } = readBluSky(PRODUCTS, PLANS_PAGE);
  guardCatalog(firm, programs);
  const changes = [];
  syncCatalog(firm, programs, changes);

  assert.ok(!changes.some((c) => /ajoute|retire|price/.test(c)), changes.join('\n'));
  // La consistency de l'evaluation Propel est passee a 55 % (checkout, blusky.pro, help center).
  for (const pl of firm.programs.find((p) => p.name === 'Propel').plans) assert.equal(pl.consistency, '55%');
  // Ce que les deux pages ne disent pas pareil reste tel que le JSON l'ecrit.
  const propel = (size) => firm.programs.find((p) => p.name === 'Propel').plans.find((pl) => pl.size === size);
  assert.equal(propel(25000).contracts, '2 minis or 25 micros');
  assert.equal(propel(150000).contracts, '1 mini or 15 micros');
  assert.equal(propel(300000).profitTarget, 20000);
  assert.equal(propel(300000).maxDrawdown, 5000);
  assert.equal('dailyLoss' in propel(300000), false);
  // Les notes ecrites a la main restent.
  const orbit = firm.programs.find((p) => p.name === 'Orbit').plans[0];
  assert.equal(orbit.note, '30 days to pass from purchase, a reset does not extend it.');
  const d2f = firm.programs.find((p) => p.name === 'Direct 2 Funded').plans[0];
  assert.match(d2f.note, /^Profit split 50% for 30 trading days, then 80%\./);
  // Les frais de Launch, deja dans le JSON, ne bougent pas.
  assert.deepEqual(
    firm.programs.find((p) => p.name === 'Launch').plans.map((pl) => pl.activationFee),
    [99, 149, 179],
  );
});

test('un programme ou une taille que BluSky ajoute apparait seul, avec ses regles', () => {
  const list = structuredClone(PRODUCTS);
  const propel = list.find((g) => g.challenge_type === 'PROPEL');
  propel.products.push(productLike(propel.products[1], { name: 'PROPEL 75K', size: '75K', price: '190' }));
  const launch = list.find((g) => g.challenge_type === 'Launch');
  list.splice(3, 0, {
    challenge_type: 'Static Growth',
    products: [productLike(launch.products[0], { name: 'STATIC GROWTH 50K', size: '50K', price: '129' })],
  });
  list[3].products[0].challenge.no_activation_fee = true;

  const firm = firmJSON();
  const { programs } = readBluSky(list, PLANS_PAGE);
  guardCatalog(firm, programs);
  const changes = [];
  syncCatalog(firm, programs, changes);

  assert.ok(changes.includes('BluSky / Propel $75K: plan ajoute'), changes.join('\n'));
  assert.ok(changes.includes('BluSky: programme « Static Growth » ajoute (1 taille)'), changes.join('\n'));
  const p75 = firm.programs.find((p) => p.name === 'Propel').plans.find((pl) => pl.size === 75000);
  assert.deepEqual(p75, {
    size: 75000,
    price: 133, // 190 - 30 % avec JTNQ
    originalPrice: 190,
    profitTarget: 3000,
    maxDrawdown: 2000,
    ddType: 'EOD Trailing',
    dailyLoss: null,
    consistency: '55%',
    minDays: 0,
    contracts: '5 minis or 50 micros',
    activationFee: 0,
  });
  // Un programme que JTNQ_OFF ne connait pas : son prix catalogue, sans prix barre.
  const sg = firm.programs.find((p) => p.name === 'Static Growth');
  assert.equal(sg.type, 'eval');
  assert.equal(sg.priceType, 'monthly');
  assert.equal(sg.plans[0].price, 129);
  assert.equal('originalPrice' in sg.plans[0], false);
});

test('ce que BluSky ne vend plus disparait du site', () => {
  const list = structuredClone(PRODUCTS).filter((g) => g.challenge_type !== 'Instant Funded');
  const orbit = list.find((g) => g.challenge_type === 'ORBIT');
  orbit.products = orbit.products.filter((p) => p.variants[0].account_size !== '200K');

  const firm = firmJSON();
  const { programs } = readBluSky(list, PLANS_PAGE);
  guardCatalog(firm, programs);
  const changes = [];
  syncCatalog(firm, programs, changes);

  assert.ok(changes.includes('BluSky / Instant Funded: programme retire'), changes.join('\n'));
  assert.ok(changes.includes('BluSky / Orbit $200K: plan retire'), changes.join('\n'));
  assert.ok(!firm.programs.some((p) => p.name === 'Instant Funded'));
  assert.deepEqual(firm.programs.find((p) => p.name === 'Orbit').plans.map((pl) => pl.size), [50000, 100000, 150000]);
});

test('un prix qui baisse au checkout baisse sur le site, prix barre compris', () => {
  const list = structuredClone(PRODUCTS);
  for (const v of list.find((g) => g.challenge_type === 'ORBIT').products[0].variants) v.price = '179';
  const firm = firmJSON();
  const changes = [];
  syncCatalog(firm, readBluSky(list, PLANS_PAGE).programs, changes);
  assert.ok(changes.includes('BluSky / Orbit $50K: price 139.3 -> 125.3'), changes.join('\n'));
  assert.ok(changes.includes('BluSky / Orbit $50K: originalPrice 199 -> 179'), changes.join('\n'));
});

test('la synchro passe BluSky par le chemin catalogue, la promo reste ecrite a la main', async () => {
  const res = await scrapeBluSky(async () => readBluSky(PRODUCTS, PLANS_PAGE));
  assert.ok(Array.isArray(res.programs));
  assert.equal('updates' in res, false);
  assert.equal('firmPromo' in res, false);
});
