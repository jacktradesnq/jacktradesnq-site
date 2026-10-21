// Lecture du configurateur E8 (e8futures.com), sur des panneaux enregistres.
// Pas de reseau, pas de navigateur.
// Run: node --test scripts/firms-e8.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseE8Panel, plansFromPanels } from './lib/firms/e8.mjs';
import { apply, guard, scrapeE8Markets, unlistedPlans } from './scrape-prop-firms.mjs';

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

test('un programme inconnu dans le titre est une erreur, pas un plan de plus', () => {
  assert.throws(() => parseE8Panel(SIG_25K.replace('E8 Signature ·', 'E8 Turbo ·')), /inconnu.*E8 Turbo/);
});

/* ------- branchement dans scrape-prop-firms.mjs ------- */

const firmFromSite = () => {
  const data = JSON.parse(fs.readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'));
  return structuredClone(data.firms.find((f) => f.id === 'e8-markets'));
};

test('les prix lus passent le garde-fou et ne changent rien au JSON du 2026-10-21', async () => {
  const firm = firmFromSite();
  const res = await scrapeE8Markets(async () => plansFromPanels(PANELS));
  guard(firm, res);
  const changes = [];
  apply(firm, res, changes);
  assert.deepEqual(changes, []);
  assert.equal(firm.stale, false);
  assert.deepEqual(unlistedPlans(firm, res), []);
});

test('une taille vendue chez E8 mais absente du site est signalee, jamais ajoutee', async () => {
  const firm = firmFromSite();
  firm.programs[1].plans = firm.programs[1].plans.filter((p) => p.size !== 200000);
  const res = await scrapeE8Markets(async () => plansFromPanels(PANELS));
  guard(firm, res);
  apply(firm, res, []);
  assert.deepEqual(unlistedPlans(firm, res), ['E8 Zero MAX Futures $200K (708/1088)']);
  assert.equal(firm.programs[1].plans.some((p) => p.size === 200000), false);
});

test('un plan du site que E8 ne vend plus : mise a jour partielle refusee', async () => {
  const firm = firmFromSite();
  const res = await scrapeE8Markets(async () => plansFromPanels(PANELS.slice(1)));
  assert.throws(() => guard(firm, res), /scraped 11\/12 expected plans/);
});
