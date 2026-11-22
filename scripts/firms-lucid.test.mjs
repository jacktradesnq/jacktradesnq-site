import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { applyLucid, runLucid } from './scrape-lucid.mjs';

// Lecture brute de lucidtrading.com/#plans faite par scrape-lucid.mjs le 2026-11-22 (Chromium headless,
// code VAULT -30 %) et la firme Lucid du JSON ce jour-là. Copies figées : ces tests ne lisent pas
// public/data/*.json, que le bot réécrit chaque jour.
const READING = JSON.parse(fs.readFileSync(new URL('./__fixtures__/lucid-reading-2026-11-22.json', import.meta.url), 'utf8'));
const FIRM = JSON.parse(fs.readFileSync(new URL('./__fixtures__/lucid-firm-2026-11-22.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-23T14:30:00Z');
const dataOf = (firm = FIRM) => ({ firms: [structuredClone(firm)] });
const planOf = (firm, program, size) => firm.programs.find((p) => p.name === program).plans.find((p) => p.size === size);
const quiet = () => {};

test('la lecture du 22/11 sur la firme du 22/11 : 20 prix relus, rien à changer, lastChecked mis à jour', async () => {
  const data = dataOf();
  const lines = [];
  const res = await runLucid(data, { read: async () => READING, now: NOW, log: (l) => lines.push(l) });
  assert.equal(res.ok, true);
  assert.deepEqual(res.changes, []);
  assert.match(lines.join('\n'), /OK — 20 prix relus, rien n'a changé/);
  assert.equal(data.firms[0].lastChecked, '2026-11-23');
  assert.equal(data.firms[0].stale, false);
  assert.equal(READING.tabs.Pro['25000'].price, 81.2);
});

test('la firme du 01/11 (Pro et Flex 25K / 50K plus bas) relue le 22/11 : prix ET chiffres des notes corrigés, points finaux gardés', async () => {
  const old = structuredClone(FIRM);
  const pro25 = planOf(old, 'LucidPro', 25000);
  Object.assign(pro25, { price: 75.6, originalPrice: 108, note: pro25.note.replace('$95.90', '$90.30').replace('Reset fee $81.', 'Reset fee $75.') });
  const flex50 = planOf(old, 'LucidFlex', 50000);
  Object.assign(flex50, { price: 80.5, originalPrice: 115, note: flex50.note.replace('$95.90', '$90.30').replace('$123.20', '$115.50').replace('Reset fee $88.', 'Reset fee $80.') });
  const data = dataOf(old);
  const res = await runLucid(data, { read: async () => READING, now: NOW, log: quiet });
  assert.equal(res.ok, true);
  assert.deepEqual(data.firms[0].programs, FIRM.programs); // tout redevient la firme du 22/11, notes comprises
  assert.equal(res.changes.length, 9); // Pro 25K : prix, base, sans daily loss, reset fee ; Flex 50K : prix, base, 50 %, sans daily loss, reset fee
  assert.ok(res.changes.includes('LucidPro $25K : price 75.6 -> 81.2'));
  assert.ok(res.changes.includes('LucidFlex $50K : originalPrice 115 -> 126'));
  // Relue une 2e fois : plus rien à changer.
  const again = await runLucid(data, { read: async () => READING, now: NOW, log: quiet });
  assert.deepEqual(again.changes, []);
});

test('Lucid répond 403 / challenge Cloudflare : données gardées, stale, échec', async () => {
  const data = dataOf();
  const lines = [];
  const res = await runLucid(data, {
    read: async () => { throw new Error('page des plans pas servie (HTTP 403, titre « Just a moment... ») : challenge Cloudflare'); },
    now: NOW,
    log: (l) => lines.push(l),
  });
  assert.equal(res.ok, false);
  assert.match(lines[0], /ÉCHEC.*403.*Cloudflare.*stale: true/);
  assert.equal(data.firms[0].stale, true);
  assert.deepEqual(data.firms[0].programs, FIRM.programs);
  assert.equal(data.firms[0].lastChecked, FIRM.lastChecked);
});

test('un plan du JSON absent de leur page : échec, firme stale, rien modifié', async () => {
  const reading = structuredClone(READING);
  delete reading.tabs.Flex['50000'];
  const data = dataOf();
  const lines = [];
  const res = await runLucid(data, { read: async () => reading, now: NOW, log: (l) => lines.push(l) });
  assert.equal(res.ok, false);
  assert.match(lines[0], /LucidFlex \$50K du JSON pas trouvé/);
  assert.equal(data.firms[0].stale, true);
  assert.deepEqual(data.firms[0].programs, FIRM.programs);
});

test('une remise qui n\'est plus -30 % : échec, à relire à la main, jamais un prix faux écrit', async () => {
  const reading = structuredClone(READING);
  reading.tabs.Pro['25000'].price = 92.8; // 116 -20 %
  const data = dataOf();
  const lines = [];
  const res = await runLucid(data, { read: async () => reading, now: NOW, log: (l) => lines.push(l) });
  assert.equal(res.ok, false);
  assert.match(lines[0], /la promo a changé/);
  assert.deepEqual(data.firms[0].programs, FIRM.programs);
});

test('une carte qui ne revient pas à son prix après les boutons : échec', () => {
  const reading = structuredClone(READING);
  reading.tabs.Daily['100000'].unstable = true;
  assert.throws(() => applyLucid(structuredClone(FIRM), reading, '2026-11-23'), /LucidDaily.*100K.*pas revenue à son prix/);
});

test('la note parle du prix sans daily loss mais leur page ne l\'a pas donné : échec', () => {
  const reading = structuredClone(READING);
  delete reading.tabs.Pro['150000'].dllOff;
  assert.throws(() => applyLucid(structuredClone(FIRM), reading, '2026-11-23'), /LucidPro \$150K.*sans daily loss/);
});

test('code VAULT absent de leur page : une notice, pas un échec', () => {
  const reading = { ...structuredClone(READING), codeSeen: false };
  const { notices, changes } = applyLucid(structuredClone(FIRM), reading, '2026-11-23');
  assert.deepEqual(changes, []);
  assert.match(notices[0], /VAULT.*n'apparaît plus/);
});

test('les 5 programmes du JSON Lucid sont connus du script', () => {
  for (const p of FIRM.programs) assert.doesNotThrow(() => applyLucid(structuredClone(FIRM), READING, '2026-11-23'), p.name);
  assert.deepEqual(FIRM.programs.map((p) => p.name), ['LucidPro', 'LucidFlex', 'LucidDaily (EOD eval drawdown)', 'LucidDaily (Intraday eval drawdown)', 'LucidDirect']);
});
