import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLUE_GUARDIAN_SOURCE,
  BLUE_GUARDIAN_URL,
  fetchBlueGuardianPrograms,
  programsFromHtml,
} from './lib/firms/blueguardian.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(
  path.join(HERE, 'lib/firms/fixtures/blueguardian-futures-2026-09-13.html'),
  'utf8',
);

/** Reconstruit un fragment `self.__next_f.push([1,"<id>:<json>"])` comme le fait Next.js. */
function pushChunk(id, data) {
  const inner = `${id}:${JSON.stringify(data)}`;
  return `<script>self.__next_f.push([1,${JSON.stringify(inner)}])</script>`;
}

const programs = programsFromHtml(html);
const programme = (name) => programs.find((p) => p.name === name);
const plan = (name, size) => programme(name)?.plans.find((p) => p.size === size);

test('programsFromHtml : les 4 programmes futures, dans l ordre du site', () => {
  assert.deepEqual(
    programs.map((p) => p.name),
    ['Standard', 'Reserve', 'Express', 'Direct'],
  );
});

test('programsFromHtml : Express a ses 4 tailles, dont la 25K a $80 que le dataset n a pas', () => {
  const express = programme('Express');
  assert.deepEqual(
    express.plans.map((p) => p.size),
    [25000, 50000, 100000, 150000],
  );
  const p25 = plan('Express', 25000);
  assert.equal(p25.price, 80);
  assert.equal(p25.originalPrice, 106);
});

test('programsFromHtml : Direct est un compte instant, les evals sont des eval', () => {
  assert.equal(programme('Direct').type, 'instant');
  for (const name of ['Standard', 'Reserve', 'Express']) {
    assert.equal(programme(name).type, 'eval');
  }
});

test('programsFromHtml : tout est vendu en prix unique, une fois', () => {
  for (const p of programs) assert.equal(p.priceType, 'one-time');
});

test('programsFromHtml : Direct n a pas de profit target (fait, pas une inconnue), et l affiche explicitement', () => {
  for (const size of [25000, 50000, 100000, 150000]) {
    const p = plan('Direct', size);
    assert.ok('profitTarget' in p, `profitTarget devrait etre explicite pour Direct ${size}`);
    assert.equal(p.profitTarget, null);
  }
});

test('programsFromHtml : Direct n a pas de regle de consistance unique, on ne l invente pas', () => {
  for (const size of [25000, 50000, 100000, 150000]) {
    assert.ok(!('consistency' in plan('Direct', size)), `consistency ne doit pas exister pour Direct ${size}`);
  }
});

test('programsFromHtml : une limite de perte journaliere absente est un null explicite', () => {
  assert.equal(plan('Standard', 25000).dailyLoss, null);
  assert.equal(plan('Reserve', 25000).dailyLoss, null);
  assert.equal(plan('Express', 25000).dailyLoss, null);
});

test('programsFromHtml : le "soft breach" de Standard est le seul dailyLossSoft a true', () => {
  assert.equal(plan('Standard', 25000).dailyLossSoft, false);
  assert.equal(plan('Standard', 50000).dailyLoss, 1000);
  assert.equal(plan('Standard', 50000).dailyLossSoft, true);
  assert.equal(plan('Standard', 100000).dailyLossSoft, true);
  assert.equal(plan('Standard', 150000).dailyLossSoft, true);

  // Express a bien une limite chiffree sur ce releve, mais le texte "soft breach"
  // n'y est pas : contrairement au dataset du site, ce n'est pas une limite souple.
  assert.equal(plan('Express', 50000).dailyLoss, 1000);
  assert.equal(plan('Express', 50000).dailyLossSoft, false);
});

test('programsFromHtml : les regles lues collent au releve (Standard 50K)', () => {
  const p = plan('Standard', 50000);
  assert.equal(p.profitTarget, 3000);
  assert.equal(p.maxDrawdown, 2000);
  assert.equal(p.ddType, 'EOD Trailing');
  assert.equal(p.consistency, 'None');
  assert.equal(p.contracts, '4 Mini | 40 Micro');
});

test('programsFromHtml : Direct lit ses regles dans fundedRules (pas de challengeRules)', () => {
  const p = plan('Direct', 100000);
  assert.equal(p.maxDrawdown, 3500);
  assert.equal(p.ddType, 'EOD');
  assert.equal(p.dailyLoss, 2500);
  assert.equal(p.contracts, '8 Mini | 80 Micro');
});

test('programsFromHtml : les plans sont tries par taille croissante', () => {
  for (const p of programs) {
    const sizes = p.plans.map((x) => x.size);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), p.name);
  }
});

test('programsFromHtml : aucune cle null en dehors de profitTarget (Direct) et dailyLoss (regle absente)', () => {
  const nulls = [];
  const walk = (o, p) => {
    for (const [k, v] of Object.entries(o)) {
      if (v === null) nulls.push(`${p}.${k}`);
      else if (v && typeof v === 'object') walk(v, `${p}.${k}`);
    }
  };
  programs.forEach((p) => p.plans.forEach((pl, i) => walk(pl, `${p.name}[${i}]`)));
  assert.ok(nulls.length > 0);
  for (const n of nulls) assert.ok(/\.(profitTarget|dailyLoss)$/.test(n), n);
});

test('programsFromHtml : un market "cfd" seul ne fabrique aucun programme futures', () => {
  const cfdOnly = pushChunk('1', [
    '$',
    '$L0',
    null,
    {
      plans: [
        {
          id: 99,
          market: 'cfd',
          key: 'one_step',
          label: '1 Step Standard',
          hasChallengeRules: true,
          order: 0,
          sizes: [{ amount: 25000, currentPrice: 100, originalPrice: 130, challengeRules: [], fundedRules: [] }],
        },
      ],
    },
  ]);
  assert.throws(() => programsFromHtml(cfdOnly), /aucun produit "market":"futures"/);
});

test('programsFromHtml : un HTML vide (page changee ou injoignable) se plaint au lieu de rendre zero programme', () => {
  assert.throws(() => programsFromHtml(''), /aucun produit "market":"futures"/);
  assert.throws(() => programsFromHtml('<html><body>rien ici</body></html>'), /aucun produit "market":"futures"/);
});

test('fetchBlueGuardianPrograms : lit la page et rend les 4 programmes futures', async () => {
  let vu = null;
  const fetchImpl = async (url) => {
    vu = url;
    return { ok: true, text: async () => html };
  };
  const progs = await fetchBlueGuardianPrograms({ fetchImpl });
  assert.equal(vu, BLUE_GUARDIAN_URL);
  assert.equal(progs.length, 4);
  assert.equal(BLUE_GUARDIAN_SOURCE, 'page blueguardian.com/futures');
});

test('fetchBlueGuardianPrograms : une panne se dit clairement, elle ne se devine pas', async () => {
  await assert.rejects(
    fetchBlueGuardianPrograms({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /HTTP 503/,
  );
  await assert.rejects(
    fetchBlueGuardianPrograms({
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
    }),
    /injoignable/,
  );
  await assert.rejects(
    fetchBlueGuardianPrograms({ fetchImpl: async () => ({ ok: true, text: async () => '' }) }),
    /aucun produit "market":"futures"/,
  );
});
