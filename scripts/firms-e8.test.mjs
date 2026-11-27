// Lecture du configurateur E8 (e8futures.com), sur des panneaux enregistres.
// Pas de reseau, pas de navigateur.
// Run: node --test scripts/firms-e8.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { guardCatalog, syncCatalog } from './lib/catalog-sync.mjs';
import { e8Programs, parseE8Panel, plansFromPanels } from './lib/firms/e8.mjs';
import { scrapeE8Markets } from './scrape-prop-firms.mjs';

/** Les 12 panneaux lus le 2026-10-21, un par tuile cliquee (3 programmes x 4 tailles). */
const PANELS = JSON.parse(
  fs.readFileSync(new URL('./lib/firms/fixtures/e8-configurator-2026-10-21.json', import.meta.url), 'utf8'),
);
const SIG_25K = PANELS[0].text;

test('les 12 plans vendus le 2026-10-21, prix barre et prix remise', () => {
  const table = plansFromPanels(PANELS).map((p) => [p.programName, p.size, p.price, p.originalPrice]);
  assert.deepEqual(table, [
    ['E8 Signature Futures', 25000, 90, 120],
    ['E8 Signature Futures', 50000, 128, 170],
    ['E8 Signature Futures', 100000, 210, 280],
    ['E8 Signature Futures', 150000, 338, 450],
    ['E8 Zero MAX Futures', 25000, 149, 228],
    ['E8 Zero MAX Futures', 50000, 214, 328],
    ['E8 Zero MAX Futures', 100000, 383, 588],
    ['E8 Zero MAX Futures', 200000, 708, 1088],
    ['E8 Zero Starter Futures', 25000, 84, 128],
    ['E8 Zero Starter Futures', 50000, 142, 218],
    ['E8 Zero Starter Futures', 100000, 220, 338],
    ['E8 Zero Starter Futures', 150000, 285, 438],
  ]);
});

/** Les 12 panneaux relus en direct le 28/11/2026 (00:20 heure de Paris), boutons « Account type » lus sur la page. */
const PANELS_1128 = JSON.parse(
  fs.readFileSync(new URL('./lib/firms/fixtures/e8-configurator-2026-11-28.json', import.meta.url), 'utf8'),
);

test('le 28/11/2026, E8 vend les memes 12 plans aux memes prix (« Save $X with code E8 » sans « on first order »)', () => {
  const now = plansFromPanels(PANELS_1128).map((p) => [p.programName, p.size, p.price, p.originalPrice, p.rules]);
  const then = plansFromPanels(PANELS).map((p) => [p.programName, p.size, p.price, p.originalPrice, p.rules]);
  assert.deepEqual(now, then);
});

test('les regles viennent de CHALLENGE RULES, pas du compte finance', () => {
  // Le Signature affiche 35 % de consistency et une « Daily Pause », mais dans
  // PERFORMANCE RULES : l'evaluation, elle, n'en a pas.
  assert.deepEqual(parseE8Panel(SIG_25K).rules, { profitTarget: 1500, maxDrawdown: 1000, consistency: null });
  assert.deepEqual(parseE8Panel(PANELS[4].text).rules, {
    profitTarget: 1500,
    maxDrawdown: 1000,
    consistency: '40%',
  });
});

test('un panneau qui ne suit pas le clic arrete tout', () => {
  // Vu en vrai le 2026-10-21 : le premier clic sur $25K laissait le panneau sur $100K.
  const lagging = [{ ...PANELS[0], text: PANELS[2].text }];
  assert.throws(() => plansFromPanels(lagging), /clic sur E8 Signature .*\$25K.*panneau affiche E8 Signature \$100K/);
});

test('« Save $X » qui ne colle pas aux deux prix : refuse', () => {
  assert.throws(() => parseE8Panel(SIG_25K.replace('Save $30', 'Save $31')), /ne fait pas les \$31/);
});

test('sans remise, un seul prix : price = originalPrice', () => {
  const plain = SIG_25K.replace('$120\n$90\n\nSave $30 with code E8 on first order\n\n', '$120\n\n');
  const p = parseE8Panel(plain);
  assert.equal(p.price, 120);
  assert.equal(p.originalPrice, 120);
});

test('l ancienne mise en page (cartes « ACCOUNT SIZE ») ne passe pas pour la nouvelle', () => {
  const old = 'ACCOUNT SIZE\n\n$25K\n\nPRICE\n\n$99\n$110\n\nGET STARTED\nCHALLENGE RULES\nProfit Target\n$1,500';
  assert.throws(() => parseE8Panel(old), /sans titre/);
});

test('un programme qu E8 ajoute se lit comme les autres, au nom du bouton + « Futures »', () => {
  const p = parseE8Panel(SIG_25K.replace('E8 Signature ·', 'E8 Turbo ·'));
  assert.equal(p.tab, 'E8 Turbo');
  assert.equal(p.programName, 'E8 Turbo Futures');
  assert.equal(p.size, 25000);
  // Le titre doit toujours nommer le bouton clique : un panneau d'un autre programme arrete tout.
  assert.throws(
    () => plansFromPanels([{ tab: 'E8 Signature', tile: '$25K', text: SIG_25K.replace('E8 Signature ·', 'E8 Turbo ·') }]),
    /clic sur E8 Signature .*panneau affiche E8 Turbo \$25K/,
  );
});

test('e8Programs : le catalogue dans la forme du dataset, seulement ce que le panneau dit', () => {
  const programs = e8Programs(plansFromPanels(PANELS));
  assert.deepEqual(
    programs.map((p) => [p.name, p.type, p.priceType, p.plans.length]),
    [
      ['E8 Signature Futures', 'eval', 'one-time', 4],
      ['E8 Zero MAX Futures', 'eval', 'one-time', 4],
      ['E8 Zero Starter Futures', 'eval', 'one-time', 4],
    ],
  );
  // Signature : pas de ligne de consistency dans CHALLENGE RULES, donc pas de cle (jamais « None » devine).
  assert.deepEqual(programs[0].plans[0], {
    size: 25000,
    price: 90,
    originalPrice: 120,
    profitTarget: 1500,
    maxDrawdown: 1000,
    ddType: 'EOD Trailing',
  });
  assert.deepEqual(programs[1].plans[3], {
    size: 200000,
    price: 708,
    originalPrice: 1088,
    profitTarget: 13500,
    maxDrawdown: 6000,
    ddType: 'EOD Trailing',
    consistency: '40%',
  });
});

test('e8Programs : une ligne illisible n a pas de cle, jamais de valeur inventee', () => {
  const text = SIG_25K.replace('EOD Dynamic Drawdown\n$1,000\nPass in', 'Trailing Drawdown\nask support\nPass in');
  const [prog] = e8Programs([parseE8Panel(text)]);
  assert.equal('maxDrawdown' in prog.plans[0], false);
  assert.equal('ddType' in prog.plans[0], false); // libelle inconnu : pas de ddType
  assert.equal(prog.plans[0].profitTarget, 1500);
});

test('e8Programs : « Max contracts » en minis / micros garde leurs mots, un nombre nu n a pas de cle', () => {
  const withUnits = SIG_25K.replace('PERFORMANCE RULES', 'Max contracts\n2 minis / 20 micros\n\nPERFORMANCE RULES');
  assert.equal(e8Programs([parseE8Panel(withUnits)])[0].plans[0].contracts, '2 minis / 20 micros');
  const bare = SIG_25K.replace('PERFORMANCE RULES', 'Max contracts\n5\n\nPERFORMANCE RULES');
  assert.equal('contracts' in e8Programs([parseE8Panel(bare)])[0].plans[0], false);
});

/* ------- branchement dans scrape-prop-firms.mjs ------- */

// Une COPIE figée du JSON du site (fixtures/prop-firms-snapshot-2026-11-19.json), pas le fichier vivant :
// le bot le réécrit chaque jour, et un prix légitime qui bouge ne doit pas bloquer la synchro avant sa
// lecture (Angelo, 19/11/2026 : « oui » à assouplir ces tests figés ; la synchro est restée rouge 13 jours).
const firmFromSite = () => {
  const data = JSON.parse(fs.readFileSync(new URL('./lib/firms/fixtures/prop-firms-snapshot-2026-11-19.json', import.meta.url), 'utf8'));
  return structuredClone(data.firms.find((f) => f.id === 'e8-markets'));
};

/** Les panneaux d'un programme, recopies sous un autre nom de bouton (un programme qu'E8 ajouterait). */
const renamed = (from, to) =>
  PANELS.filter((p) => p.tab === from).map((p) => ({ ...p, tab: to, text: p.text.replace(`${from} ·`, `${to} ·`) }));

const sync = async (firm, panels) => {
  const res = await scrapeE8Markets(async () => plansFromPanels(panels));
  guardCatalog(firm, res.programs);
  const changes = [];
  syncCatalog(firm, res.programs, changes, res.catalog);
  return changes;
};

test('le catalogue lu le 2026-10-21 ne change rien au JSON (copie figee du 2026-11-19)', async () => {
  const firm = firmFromSite();
  const before = structuredClone(firm);
  const changes = await sync(firm, PANELS);
  assert.deepEqual(changes, []);
  // Les regles que le panneau ne donne pas restent celles ecrites a la main.
  assert.deepEqual(firm, before);
});

test('une taille vendue chez E8 mais absente du site est ajoutee, avec les regles lues', async () => {
  const firm = firmFromSite();
  firm.programs[1].plans = firm.programs[1].plans.filter((p) => p.size !== 200000);
  const changes = await sync(firm, PANELS);
  assert.deepEqual(changes, [
    'E8 Markets / E8 Zero MAX Futures $200K: plan ajoute (repris des autres tailles : dailyLoss null, dailyLossSoft false)',
  ]);
  assert.deepEqual(firm.programs[1].plans.map((p) => p.size), [25000, 50000, 100000, 200000]);
  // Ce que le panneau dit, plus ce que les 3 autres tailles ecrites a la main partagent
  // (dailyLoss null, dailyLossSoft false). Contracts differe selon les tailles : jamais repris.
  assert.deepEqual(firm.programs[1].plans[3], {
    size: 200000,
    price: 708,
    originalPrice: 1088,
    profitTarget: 13500,
    maxDrawdown: 6000,
    ddType: 'EOD Trailing',
    dailyLoss: null,
    dailyLossSoft: false,
    consistency: '40%',
  });
});

/** Le panneau Signature 150K, relu comme une taille 200K qu'E8 ajouterait. */
const signature200K = () => {
  const p = PANELS.find((x) => x.tab === 'E8 Signature' && /\$150K/.test(x.tile));
  return { ...p, tile: p.tile.replace('$150K', '$200K'), text: p.text.replace('· $150K', '· $200K') };
};

test('une taille Signature nouvelle reprend la consistency « None » que toutes ses tailles portent', async () => {
  const firm = firmFromSite();
  const changes = await sync(firm, [...PANELS.slice(0, 4), signature200K(), ...PANELS.slice(4)]);
  assert.deepEqual(changes, [
    'E8 Markets / E8 Signature Futures $200K: plan ajoute (repris des autres tailles : dailyLoss null, dailyLossSoft false, consistency "None")',
  ]);
  const plan = firm.programs[0].plans.find((p) => p.size === 200000);
  assert.equal(plan.consistency, 'None'); // pas de ligne dans CHALLENGE RULES : la regle ecrite a la main passe avant la cle absente
  assert.equal('contracts' in plan, false); // 2 / 4 / 8 / 12 minis selon les tailles : jamais repris
  assert.equal(plan.profitTarget, 9000); // ce que le panneau dit reste le sien
});

test('une valeur qui differe selon les tailles ne se reprend jamais, une valeur lue gagne', async () => {
  const firm = firmFromSite();
  firm.programs[0].plans[1].consistency = '35%'; // Signature : plus la meme valeur partout
  firm.programs[0].plans[2].dailyLossSoft = true;
  let changes = await sync(firm, [...PANELS.slice(0, 4), signature200K(), ...PANELS.slice(4)]);
  assert.deepEqual(changes, ['E8 Markets / E8 Signature Futures $200K: plan ajoute (repris des autres tailles : dailyLoss null)']);
  const plan = firm.programs[0].plans.find((p) => p.size === 200000);
  assert.equal('consistency' in plan, false);
  assert.equal('dailyLossSoft' in plan, false);

  // Zero MAX ecrit « None » a la main sur ses 3 tailles, le panneau de la 4e dit « 40% » : le panneau gagne.
  const zero = firmFromSite();
  zero.programs[1].plans = zero.programs[1].plans.filter((p) => p.size !== 200000);
  for (const p of zero.programs[1].plans) p.consistency = 'None';
  changes = await sync(zero, PANELS);
  assert.equal(zero.programs[1].plans[3].consistency, '40%');
});

test('un programme qu E8 ajoute apparait seul sur le site', async () => {
  const firm = firmFromSite();
  const changes = await sync(firm, [...PANELS, ...renamed('E8 Zero MAX', 'E8 Turbo')]);
  assert.deepEqual(changes, ['E8 Markets: programme « E8 Turbo Futures » ajoute (4 tailles)']);
  const turbo = firm.programs.find((p) => p.name === 'E8 Turbo Futures');
  // Aucune taille publiee a qui reprendre une regle : seulement ce que les panneaux disent.
  assert.equal('dailyLoss' in turbo.plans[0], false);
  assert.equal(turbo.type, 'eval');
  assert.equal(turbo.priceType, 'one-time');
  assert.deepEqual(turbo.plans.map((p) => [p.size, p.price, p.originalPrice]), [
    [25000, 149, 228],
    [50000, 214, 328],
    [100000, 383, 588],
    [200000, 708, 1088],
  ]);
});

test('une taille qu E8 ne vend plus disparait du site', async () => {
  const firm = firmFromSite();
  const changes = await sync(firm, PANELS.slice(1));
  assert.deepEqual(changes, ['E8 Markets / E8 Signature Futures $25K: plan retire']);
  assert.deepEqual(firm.programs[0].plans.map((p) => p.size), [50000, 100000, 150000]);
});

test('un programme qu E8 ne vend plus disparait du site', async () => {
  const firm = firmFromSite();
  const changes = await sync(firm, PANELS.filter((p) => p.tab !== 'E8 Zero Starter'));
  assert.deepEqual(changes, ['E8 Markets / E8 Zero Starter Futures: programme retire']);
  assert.deepEqual(firm.programs.map((p) => p.name), ['E8 Signature Futures', 'E8 Zero MAX Futures']);
});

test('un prix qui bouge est ecrit, les regles a la main restent', async () => {
  const firm = firmFromSite();
  const panels = structuredClone(PANELS);
  panels[0].text = panels[0].text.replace('$120\n$90\n\nSave $30', '$120\n$84\n\nSave $36');
  const changes = await sync(firm, panels);
  assert.deepEqual(changes, ['E8 Markets / E8 Signature Futures $25K: price 90 -> 84']);
  const plan = firm.programs[0].plans[0];
  assert.equal(plan.consistency, 'None');
  assert.equal(plan.dailyLoss, null);
  assert.equal(plan.dailyLossSoft, false);
  assert.equal(plan.contracts, '2 minis / 20 micros');
});

test('une page partielle ne vide pas le catalogue', async () => {
  const firm = firmFromSite();
  const res = await scrapeE8Markets(async () => plansFromPanels(PANELS.slice(0, 5)));
  assert.throws(() => guardCatalog(firm, res.programs), /rend 5 plans la ou le JSON en publie 12/);
});
