// The copy layer: Angelo edits content/newsletter/, this proves the machine
// obeys the file and refuses to guess.
// Run: node --test scripts/copy.test.mjs
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCopy, fill, useCopy, resetCopy, loadCopy, assertComplete, parseLabels } from './lib/copy.mjs';
import { pickDeal, renderTweet, renderDiscord, renderEmail } from './lib/deal-of-day.mjs';

const DATA = JSON.parse(readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'));
const SHIPPED = readFileSync(new URL('../content/newsletter/messages.md', import.meta.url), 'utf8');
const TAKES = readFileSync(new URL('../content/newsletter/takes.md', import.meta.url), 'utf8');

afterEach(resetCopy);

const deal = () => pickDeal(DATA, { today: '2026-08-20', history: [] });

// ── the parser ───────────────────────────────────────────────────────────────

test('the notes and the placeholder table never leak into the copy', () => {
  const blocks = parseCopy(SHIPPED);
  assert.ok(!blocks['catch.activation'].includes('|'), 'the doc table leaked into the last block');
  assert.ok(!blocks['catch.activation'].includes('{firm}'), 'the doc table leaked into the last block');
  assert.equal(blocks['email.eyebrow'], 'Deal of the day');
});

test('a hyphenated firm id is a heading, not text', () => {
  const blocks = parseCopy(TAKES);
  for (const id of ['top-one-futures', 'e8-markets', 'blue-guardian', 'traders-launch']) {
    assert.ok(id in blocks, `${id} was not read as a section`);
    assert.equal(blocks[id], '', `${id} should be empty until Angelo writes it`);
  }
});

// ── the guards ───────────────────────────────────────────────────────────────

test('an invented placeholder is refused, and the message says what exists', () => {
  assert.throws(
    () => fill('{price} for a {vibe}', { price: '$99' }, { blockName: 'email.lead' }),
    (err) => {
      assert.match(err.message, /email\.lead: unknown placeholder \{vibe\}/);
      assert.match(err.message, /Available: price/);
      return true;
    }
  );
});

test('a missing block is named, not silently blank', () => {
  const gutted = SHIPPED.replace('## email.cta', '## email.cta_typo');
  assert.throws(
    () => assertComplete(parseCopy(gutted)),
    /messages\.md is missing: email\.cta/
  );
});

test('a missing label is named too', () => {
  const gutted = SHIPPED.replace('maxdd = Max drawdown', '');
  assert.throws(() => assertComplete(parseCopy(gutted)), /email\.labels is missing: maxdd/);
});

test('a bracketed group disappears when its value is empty', () => {
  const t = '{price} for a {account}[, instead of {was}].';
  assert.equal(fill(t, { price: '$99', account: '50K challenge', was: '$150' }), '$99 for a 50K challenge, instead of $150.');
  assert.equal(fill(t, { price: '$99', account: '50K challenge', was: '' }), '$99 for a 50K challenge.');
});

// ── editing the file changes the messages ────────────────────────────────────

test('rewriting one line in the file rewrites all three messages', () => {
  const before = { tweet: renderTweet(deal()), discord: renderDiscord(deal()), email: renderEmail(deal(), {}) };
  assert.match(before.tweet, /for a 50K challenge/);

  resetCopy();
  useCopy(
    SHIPPED.replace(
      '## tweet\n{price} for a {account}',
      '## tweet\nGrab the {size} for {price} today'
    ).replace('## email.cta\nGet the {size} at {price}', '## email.cta\nTake the {size}'),
    TAKES
  );

  const after = { tweet: renderTweet(deal()), email: renderEmail(deal(), {}) };
  assert.match(after.tweet, /^Grab the 50K for \$104\.95 today/);
  assert.ok(!after.tweet.includes('for a 50K challenge'), 'the old wording survived');
  assert.match(after.email.html, />Take the 50K</);
  assert.ok(!after.email.html.includes('Get the 50K at'), 'the old button survived');
});

test('a take written in takes.md shows up, an empty one shows nothing', () => {
  const plain = renderEmail(deal(), {});
  assert.ok(!plain.html.includes('What I watch'), 'an empty take should print nothing');

  resetCopy();
  useCopy(SHIPPED, TAKES.replace('## fundedseat', '## fundedseat\nI size down after a green day here, the {maxdd} trails.'));
  const withTake = renderEmail(deal(), {});
  assert.match(withTake.html, /What I watch/);
  assert.match(withTake.html, /size down after a green day here, the \$2,000 trails\./);
  assert.match(renderDiscord(deal()), /I size down after a green day/);
  assert.match(withTake.text, /I size down after a green day/);
});

test('a take on another firm stays on that firm', () => {
  useCopy(SHIPPED, TAKES.replace('## tradeday', '## tradeday\nTradeDay only pays fast if you pass.'));
  assert.ok(!renderEmail(deal(), {}).html.includes('pays fast'), 'a take leaked across firms');
  assert.match(
    renderEmail(pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'tradeday' }), {}).html,
    /pays fast if you pass/
  );
});

// ── markup stays where it belongs ────────────────────────────────────────────

test('stars become bold in the email and are left alone for Discord', () => {
  const email = renderEmail(deal(), {});
  assert.match(email.html, /<strong style="color:#E9B44B;">\$104\.95<\/strong>/);
  assert.ok(!email.html.includes('*'), 'a raw star reached the email');
  assert.ok(!email.text.includes('*'), 'a raw star reached the plain text');

  // Discord's own bold is **, which must survive untouched.
  assert.match(renderDiscord(deal()), /^\*\*FundedSeat, deal of the day\*\*/);
});

test('the shipped file passes its own completeness check', () => {
  const { messages } = loadCopy();
  assert.equal(assertComplete(messages), true);
  assert.equal(parseLabels(messages['email.labels']).maxdd, 'Max drawdown');
});
