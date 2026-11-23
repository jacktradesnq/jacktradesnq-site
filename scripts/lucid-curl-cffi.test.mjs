import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

import { lucidConfigFromHtml, readingFromConfig, readLucidViaCurlCffi, readLucid } from './scrape-lucid.mjs';
import { cfFetch } from './lib/cf-fetch.mjs';

// Copies figées du 23/11/2026 : le JSON `LucidPricingConfig` de lucidtrading.com (HTML lu par curl_cffi) et la
// lecture du même jour faite dans le DOM par le Chromium headless de playwright (scrape-lucid.mjs --dry --dump).
// Les deux méthodes donnent exactement la même lecture : c'est la porte d'égalité du lecteur curl_cffi.
const CONFIG = JSON.parse(fs.readFileSync(new URL('./__fixtures__/lucid-config-2026-11-23.json', import.meta.url), 'utf8'));
const DOM_READING = JSON.parse(fs.readFileSync(new URL('./__fixtures__/lucid-reading-2026-11-23.json', import.meta.url), 'utf8'));
const READING_22_11 = JSON.parse(fs.readFileSync(new URL('./__fixtures__/lucid-reading-2026-11-22.json', import.meta.url), 'utf8'));
const pageOf = (cfg, visible = '<span class="promo-code">VAULT </span>') =>
  `<html><head><title>Lucid Trading</title></head><body>${visible}<script id="x">var LucidPricingConfig = ${JSON.stringify(cfg)};\n//# sourceURL=x</script></body></html>`;

test('le JSON de leur page donne EXACTEMENT la lecture du DOM (Pro, Flex, Daily EOD + Intraday, Direct ; dllOff, c50, reset)', () => {
  assert.deepStrictEqual(readingFromConfig(CONFIG, '<span>VAULT </span>'), DOM_READING);
  assert.deepStrictEqual(DOM_READING, READING_22_11); // aucun prix n'avait bougé entre le 22/11 et le 23/11
});

test('lucidConfigFromHtml : lit le JSON dans le HTML brut, chaînes à accolades et guillemets échappés comprises', () => {
  const cfg = structuredClone(CONFIG);
  cfg.plans.planTypes[0].meta[0].value = 'a } b " c { d \\ e';
  assert.equal(lucidConfigFromHtml(pageOf(cfg)).plans.planTypes[0].meta[0].value, 'a } b " c { d \\ e');
});

test('code VAULT : codeSeen vrai s\'il est dans le texte visible, faux s\'il n\'est que dans le script', () => {
  assert.equal(readingFromConfig(CONFIG, pageOf(CONFIG)).codeSeen, true);
  assert.equal(readingFromConfig(CONFIG, pageOf(CONFIG, '<p>no promo</p>')).codeSeen, false);
});

test('page de challenge Cloudflare, JSON absent ou schéma inconnu : erreur claire (la firme passera stale)', () => {
  assert.throws(() => lucidConfigFromHtml('<html><title>Just a moment...</title></html>'), /absent.*challenge Cloudflare/);
  assert.throws(() => lucidConfigFromHtml('<html><title>Lucid</title></html>'), /LucidPricingConfig absent/);
  const v2 = structuredClone(CONFIG);
  v2.plans.schemaVersion = 2;
  assert.throws(() => lucidConfigFromHtml(pageOf(v2)), /schemaVersion 2 inconnue/);
});

test('un produit qui manque dans le JSON laisse son prix absent : applyLucid le signalera, aucun prix inventé', () => {
  const cfg = structuredClone(CONFIG);
  delete cfg.productPrices['56539']; // Pro 25K
  const r = readingFromConfig(cfg, '');
  assert.equal(r.tabs.Pro['25000'], undefined);
  assert.equal(r.tabs.Pro['50000'].price, 126);
});

test('un prix de base qui monte : le prix remisé suit la remise de la taille (-30 %)', () => {
  const cfg = structuredClone(CONFIG);
  cfg.productPrices['56539'] = '120'; // Pro 25K : 116 -> 120
  const e = readingFromConfig(cfg, '').tabs.Pro['25000'];
  assert.deepEqual({ original: e.original, price: e.price, dllOff: e.dllOff }, { original: 120, price: 84, dllOff: 98.7 });
});

test('readLucidViaCurlCffi : statut 403 = erreur ; 200 = lecture', async () => {
  await assert.rejects(readLucidViaCurlCffi({ fetchPage: async () => ({ status: 403, text: 'Just a moment' }) }), /HTTP 403/);
  const lines = [];
  const r = await readLucidViaCurlCffi({ fetchPage: async () => ({ status: 200, text: pageOf(CONFIG), via: 'safari' }), log: (l) => lines.push(l) });
  assert.deepStrictEqual(r, DOM_READING);
  assert.match(lines[0], /curl_cffi, profil safari/);
});

test('readLucid : curl_cffi d\'abord, 3 essais ; en échec, repli sur le navigateur ; le log dit lequel a lu', async () => {
  const lines = [];
  const log = (l) => lines.push(l);
  const opts = { log, pauseMs: 0 };
  assert.equal(await readLucid({ ...opts, viaCurl: async () => 'A', viaBrowser: async () => 'B' }), 'A');
  assert.match(lines.join('\n'), /lu par curl_cffi/);

  // un blocage passager : le 2e essai passe, le navigateur n'est pas lancé
  lines.length = 0;
  let n = 0;
  const flaky = async () => { if (++n < 2) throw new Error('HTTP 403'); return 'A'; };
  assert.equal(await readLucid({ ...opts, viaCurl: flaky, viaBrowser: async () => { throw new Error('navigateur lancé à tort'); } }), 'A');
  assert.equal(n, 2);
  assert.match(lines.join('\n'), /essai 1\/3 échoué \(HTTP 403\)/);

  // trois échecs : repli navigateur
  lines.length = 0;
  n = 0;
  const blocked = async () => { n++; throw new Error('HTTP 403'); };
  assert.equal(await readLucid({ ...opts, viaCurl: blocked, viaBrowser: async () => 'B' }), 'B');
  assert.equal(n, 3);
  assert.match(lines.join('\n'), /curl_cffi a échoué 3 fois \(HTTP 403\), repli sur le navigateur/);
  assert.match(lines.join('\n'), /lu par le navigateur headless/);

  await assert.rejects(readLucid({ ...opts, viaCurl: blocked, viaBrowser: async () => { throw new Error('challenge'); } }), /challenge/);
});

// cfFetch lance python3 + curl_cffi : ignoré là où curl_cffi n'est pas installé (le workflow l'installe).
const hasCurlCffi = spawnSync(process.env.CF_PYTHON || 'python3', ['-c', 'import curl_cffi'], { stdio: 'ignore' }).status === 0;

test('cfFetch : rend le statut et le texte (200 puis 403), erreur réseau claire', { skip: !hasCurlCffi && 'curl_cffi absent' }, async () => {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    res.statusCode = req.url === '/ok' ? 200 : 403;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(req.url === '/ok' ? '<p>bonjour é</p>' : 'Just a moment...');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await cfFetch(`${base}/ok`, { timeoutMs: 15_000 }), { status: 200, text: '<p>bonjour é</p>', via: 'chrome' });
    // 403 : chrome puis safari, deux tours (pause de 3 s), puis le statut est rendu tel quel
    const blocked = await cfFetch(`${base}/nope`, { timeoutMs: 15_000 });
    assert.deepEqual([blocked.status, blocked.text, blocked.via], [403, 'Just a moment...', 'safari']);
    assert.equal(hits.filter((u) => u === '/nope').length, 4);
  } finally {
    server.close();
  }
  await assert.rejects(cfFetch('http://127.0.0.1:1/', { timeoutMs: 5_000 }), /cf-get/);
});

test('fetchPageText : 200 direct sans curl_cffi ; 403/429/503 puis curl_cffi passe ; 404 ou curl_cffi bloqué = erreur claire', async () => {
  const { fetchPageText } = await import('./lib/cf-fetch.mjs');
  const res = (status, text = '') => async () => ({ ok: status >= 200 && status < 300, status, text: async () => text });
  const never = async () => { throw new Error('curl_cffi ne devait pas être appelé'); };
  assert.equal(await fetchPageText('https://x/', { fetchImpl: res(200, 'ok'), viaCurl: never }), 'ok');
  for (const code of [403, 429, 503]) {
    assert.equal(await fetchPageText('https://x/', { fetchImpl: res(code), viaCurl: async () => ({ status: 200, text: 'via curl' }) }), 'via curl');
  }
  await assert.rejects(fetchPageText('https://x/', { fetchImpl: res(404), viaCurl: never }), /^Error: HTTP 404 sur https:\/\/x\/$/);
  await assert.rejects(fetchPageText('https://x/', { fetchImpl: res(403), viaCurl: async () => ({ status: 403, text: '' }) }), /HTTP 403 sur https:\/\/x\/ \(curl_cffi : HTTP 403\)/);
  await assert.rejects(fetchPageText('https://x/', { fetchImpl: res(403), viaCurl: async () => { throw new Error('curl_cffi absent'); } }), /HTTP 403.*repli curl_cffi impossible : curl_cffi absent/);
});
