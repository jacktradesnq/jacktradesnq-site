#!/usr/bin/env node
// Builds the day's prop-firm deal into three renderings: email, Discord, tweet.
//
//   node scripts/build-deal-of-day.mjs                  # today, writes state
//   node scripts/build-deal-of-day.mjs --dry            # nothing written
//   node scripts/build-deal-of-day.mjs --today=2026-08-23
//   node scripts/build-deal-of-day.mjs --force=legends-trading
//   node scripts/build-deal-of-day.mjs --all            # one preview per firm
//
// State lives in data/newsletter/: history.json (7-day cooldown) and
// snapshot.json (yesterday's prices, for "new promo" / "price drop"). The
// daily workflow commits both so the rotation survives across runs.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  pickDeal,
  snapshotOf,
  renderEmail,
  renderDiscord,
  renderTweet,
  auditDiscountClaims,
} from './lib/deal-of-day.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(ROOT, 'public/data/prop-firms.json');
const STATE_DIR = join(ROOT, 'data/newsletter');
const HISTORY_FILE = join(STATE_DIR, 'history.json');
const SNAPSHOT_FILE = join(STATE_DIR, 'snapshot.json');
const OUT_DIR = join(ROOT, '.newsletter-preview');

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? null;
const has = (name) => args.includes(`--${name}`);

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);

const data = readJson(DATA_FILE, null);
if (!data) {
  console.error(`missing ${DATA_FILE}`);
  process.exit(1);
}

const today = flag('today') ?? new Date().toISOString().slice(0, 10);
const history = readJson(HISTORY_FILE, []);
const prevSnapshot = readJson(SNAPSHOT_FILE, null);

function build(deal) {
  const built = {
    deal,
    email: renderEmail(deal, { generatedAt: data.generatedAt }),
    discord: renderDiscord(deal),
    tweet: renderTweet(deal),
  };

  // Nothing leaves this script claiming a discount the data cannot back. Two
  // firms advertise "X% off + Y% with a code"; those never add up, and a
  // hand-typed percentage in the copy file is caught here too.
  const problems = auditDiscountClaims(deal, {
    subject: built.email.subject,
    email: built.email.text,
    discord: built.discord,
    tweet: built.tweet,
  });
  if (problems.length) {
    console.error('refusing to emit, discount claim does not match the data:');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  return built;
}

function writePreview(built, tag) {
  mkdirSync(OUT_DIR, { recursive: true });
  const base = join(OUT_DIR, tag);
  writeFileSync(`${base}.email.html`, built.email.html);
  writeFileSync(`${base}.email.txt`, `Subject: ${built.email.subject}\nPreheader: ${built.email.preheader}\n\n${built.email.text}\n`);
  writeFileSync(`${base}.discord.md`, `${built.discord}\n`);
  writeFileSync(`${base}.tweet.txt`, `${built.tweet}\n`);
  return base;
}

if (has('all')) {
  // Copy-review mode: render every firm so the wording can be judged on all of
  // them, not just whoever wins today.
  for (const firm of data.firms) {
    const deal = pickDeal(data, { today, history: [], prevSnapshot, forceFirmId: firm.id });
    if (!deal) {
      console.log(`-- ${firm.id}: no candidate (stale or no plans)`);
      continue;
    }
    const built = build(deal);
    const base = writePreview(built, firm.id);
    console.log(`\n=== ${deal.firmName} (score ${deal.score}, signals: ${deal.signals.join(',') || 'none'})`);
    console.log(`SUBJECT  ${built.email.subject}`);
    console.log(`TWEET\n${built.tweet}`);
    console.log(`preview: ${base}.email.html`);
  }
  process.exit(0);
}

const deal = pickDeal(data, { today, history, prevSnapshot, forceFirmId: flag('force') });
if (!deal) {
  console.error('no deal candidate today');
  process.exit(1);
}

const built = build(deal);
const base = writePreview(built, 'today');

// State first: the rotation has to advance whichever output mode is used, or
// --json runs (the ones the daily workflow uses) would replay the same firm.
const stateWritten = !has('dry') && !flag('force');
if (stateWritten) {
  mkdirSync(STATE_DIR, { recursive: true });
  const nextHistory = [...history.filter((h) => h.date !== today), { firmId: deal.firmId, date: today }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);
  writeFileSync(HISTORY_FILE, `${JSON.stringify(nextHistory, null, 2)}\n`);
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshotOf(data), null, 2)}\n`);
}

// --json prints the payload the send endpoint expects, and nothing else, so the
// daily workflow can pipe it straight into curl.
if (has('json')) {
  process.stdout.write(
    `${JSON.stringify({
      firmId: deal.firmId,
      firmName: deal.firmName,
      signals: deal.signals,
      subject: built.email.subject,
      html: built.email.html,
      text: built.email.text,
      discord: built.discord,
      tweet: built.tweet,
    })}\n`
  );
  process.exit(0);
}

console.log(`date        ${today}`);
console.log(`firm        ${deal.firmName} (score ${deal.score}, signals: ${deal.signals.join(',') || 'none'})`);
console.log(`subject     ${built.email.subject}`);
console.log(`preheader   ${built.email.preheader}`);
console.log(`\n--- DISCORD ---\n${built.discord}`);
console.log(`\n--- TWEET (${built.tweet.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length}/280) ---\n${built.tweet}`);
console.log(`\n--- EMAIL PLAIN ---\n${built.email.text}`);
console.log(`\npreview files: ${base}.email.html`);
if (stateWritten) console.log(`state updated: ${HISTORY_FILE}`);
