import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { programsFromHtml } from './lib/firms/tradeday.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, 'lib/firms/fixtures', 'tradeday-home-2026-09-13.html'), 'utf-8');

const programs = programsFromHtml(html);
const famille = (name) => programs.find((p) => p.name === name);
const plan = (name, size) => famille(name)?.plans.find((p) => p.size === size);

test('programsFromHtml : les 3 familles, dans l ordre du dataset', () => {
  assert.deepEqual(
    programs.map((p) => p.name),
    ['Quick Pay Intraday', 'Quick Pay EOD', 'Fast Pass'],
  );
});

test('programsFromHtml : chaque famille a ses 4 tailles, 25K compris (absent du dataset)', () => {
  for (const p of programs) {
    assert.deepEqual(
      p.plans.map((x) => x.size),
      [25000, 50000, 100000, 150000],
      p.name,
    );
  }
});

test('programsFromHtml : type eval et prix mensuels, comme le dataset', () => {
  for (const p of programs) {
    assert.equal(p.type, 'eval');
    assert.equal(p.priceType, 'monthly');
  }
});

test('programsFromHtml : Quick Pay Intraday, prix et prix barres exacts', () => {
  assert.deepEqual(
    famille('Quick Pay Intraday').plans.map((p) => [p.size, p.price, p.originalPrice]),
    [
      [25000, 45, 100],
      [50000, 59, 131],
      [100000, 108, 240],
      [150000, 162, 360],
    ],
  );
});

test('programsFromHtml : Quick Pay EOD, prix et prix barres exacts', () => {
  assert.deepEqual(
    famille('Quick Pay EOD').plans.map((p) => [p.size, p.price, p.originalPrice]),
    [
      [25000, 54, 120],
      [50000, 79, 175],
      [100000, 129, 285],
      [150000, 180, 400],
    ],
  );
});

test('programsFromHtml : Fast Pass, prix et prix barres exacts', () => {
  assert.deepEqual(
    famille('Fast Pass').plans.map((p) => [p.size, p.price, p.originalPrice]),
    [
      [25000, 59, 130],
      [50000, 85, 189],
      [100000, 149, 330],
      [150000, 225, 500],
    ],
  );
});

test('programsFromHtml : la nouvelle taille 25K porte bien les memes champs que les autres', () => {
  const p = plan('Quick Pay Intraday', 25000);
  assert.equal(p.profitTarget, 1500);
  assert.equal(p.maxDrawdown, 1000);
  assert.equal(p.ddType, 'Intraday');
  assert.equal(p.consistency, '30% (eval only)');
  assert.equal(p.contracts, '2 contracts (20 micros)');
});

test('programsFromHtml : ddType Intraday pour Quick Pay Intraday, EOD Trailing pour les deux autres', () => {
  for (const p of famille('Quick Pay Intraday').plans) assert.equal(p.ddType, 'Intraday');
  for (const p of famille('Quick Pay EOD').plans) assert.equal(p.ddType, 'EOD Trailing');
  for (const p of famille('Fast Pass').plans) assert.equal(p.ddType, 'EOD Trailing');
});

test('programsFromHtml : consistency "(eval only)" seulement quand le dos de la carte dit None', () => {
  for (const p of famille('Quick Pay Intraday').plans) assert.equal(p.consistency, '30% (eval only)');
  for (const p of famille('Quick Pay EOD').plans) assert.equal(p.consistency, '30% (eval only)');
  for (const p of famille('Fast Pass').plans) assert.equal(p.consistency, '45%');
});

test('programsFromHtml : contrats Fast Pass = eval / finance + palier, lu sur les deux faces de la carte', () => {
  assert.deepEqual(
    famille('Fast Pass').plans.map((p) => p.contracts),
    [
      '2 contracts eval / 1 funded, +1 per $2k',
      '5 contracts eval / 2 funded, +1 per $2k',
      '10 contracts eval / 3 funded, +1 per $2k',
      '15 contracts eval / 4 funded, +1 per $2k',
    ],
  );
});

test('programsFromHtml : aucune dailyLoss inventee, la page n en affiche aucune', () => {
  for (const p of programs) {
    for (const plan of p.plans) assert.ok(!('dailyLoss' in plan), JSON.stringify(plan));
  }
});

test('programsFromHtml : aucune cle a null, une absence sur la page est omise, jamais nulle', () => {
  const nulls = [];
  const walk = (o, path) => {
    for (const [k, v] of Object.entries(o)) {
      if (v === null) nulls.push(`${path}.${k}`);
      else if (v && typeof v === 'object') walk(v, `${path}.${k}`);
    }
  };
  programs.forEach((p) => walk(p, p.name));
  assert.deepEqual(nulls, []);
});

test('programsFromHtml : un HTML vide ou sans carte pricing se plaint au lieu de rendre zero programme', () => {
  assert.throws(() => programsFromHtml(''), /aucune carte pricing/);
  assert.throws(() => programsFromHtml('<html><body>rien ici</body></html>'), /aucune carte pricing/);
});

test('programsFromHtml : une famille/taille manquante arrete tout plutot que de publier un catalogue incomplet', () => {
  // On retire les 2 dernieres cartes entieres (Tradovate + Rithmic du Fast
  // Pass 150K, la toute derniere famille/taille de la page) : le reste de la
  // page reste bien forme, seule cette combinaison disparait.
  const FRONT_OPEN = '<div class="pricing-card_item">';
  const lastAt = html.lastIndexOf(FRONT_OPEN);
  const secondToLastAt = html.lastIndexOf(FRONT_OPEN, lastAt - 1);
  const ampute = html.slice(0, secondToLastAt);
  assert.throws(() => programsFromHtml(ampute), /manquants/);
});
