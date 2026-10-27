// Lecture du catalogue BluSky (API publique de leur checkout), sur la liste
// enregistree le 2026-10-27. Pas de reseau.
// Run: node --test scripts/firms-blusky.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { plansFromProducts, sizeOf } from './lib/firms/blusky.mjs';
import { apply, guard, scrapeBluSky } from './scrape-prop-firms.mjs';

const PRODUCTS = JSON.parse(
  fs.readFileSync(new URL('./lib/firms/fixtures/blusky-products-2026-10-27.json', import.meta.url), 'utf8'),
);
const DATA = JSON.parse(fs.readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'));

test('les 15 comptes vendus le 2026-10-27, prix avec JTNQ et prix catalogue', () => {
  const table = plansFromProducts(PRODUCTS).map((p) => [p.programName, p.size, p.price, p.originalPrice]);
  assert.deepEqual(table, [
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
  ]);
});

test('les frais de Launch (« No Type ») ne sont pas des comptes', () => {
  assert.ok(plansFromProducts(PRODUCTS).every((p) => p.programName));
});

test('un prix qui change selon la plateforme arrete la firme', () => {
  const broken = structuredClone(PRODUCTS);
  broken[0].products[0].variants[1].price = '61';
  assert.throws(() => plansFromProducts(broken), /prix differents/);
});

test('tailles', () => {
  assert.equal(sizeOf('3.5K'), 3500);
  assert.equal(sizeOf('200K'), 200000);
  assert.throws(() => sizeOf('200K Static'));
});

test('chaque compte du JSON du site est relu, et les prix du JSON sont ceux du jour', async () => {
  const firm = structuredClone(DATA.firms.find((f) => f.id === 'blusky'));
  const res = await scrapeBluSky(async () => plansFromProducts(PRODUCTS));
  guard(firm, res);
  const changes = [];
  apply(firm, res, changes);
  assert.deepEqual(changes, []);
});
