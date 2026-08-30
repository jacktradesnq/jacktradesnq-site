// The copy layer: Angelo edits content/newsletter/, this proves the machine
// obeys the file and refuses to guess.
// Run: node --test scripts/copy.test.mjs
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCopy, fill, useCopy, resetCopy, loadCopy, assertComplete, parseLabels } from './lib/copy.mjs';
import {
  pickDeal,
  renderTweet,
  renderDiscord,
  renderEmail,
  auditDiscountClaims,
  auditCodeClaims,
} from './lib/deal-of-day.mjs';

// Frozen data on purpose. These tests are about how a deal RENDERS, and the
// published file is rewritten every morning by the price sync: the day it
// marked FundedSeat stale, seventeen of these went red on main without a line
// of code changing. Freshness of the live file is checked in
// scrape-prop-firms.test.mjs and check-rule-drift.test.mjs, where it belongs.
const DATA = JSON.parse(readFileSync(new URL('./fixtures/prop-firms.fixture.json', import.meta.url), 'utf8'));
const SHIPPED = readFileSync(new URL('../content/newsletter/messages.md', import.meta.url), 'utf8');
const TAKES = readFileSync(new URL('../content/newsletter/takes.md', import.meta.url), 'utf8');
const CODES = readFileSync(new URL('../content/newsletter/codes.md', import.meta.url), 'utf8');

afterEach(resetCopy);

// Named on purpose: these tests are about how FundedSeat renders, not about
// which firm happens to win the day. LEGENDS' promo ending sooner used to
// silently take that slot and break eight of them.
const deal = () => pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });

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

// ── discounts never stack ────────────────────────────────────────────────────

test('a firm advertising two discounts never gets them added up', () => {
  // FundedSeat's real label. 45 and 50 are alternatives: the public price, or
  // the coupon. 95% off does not exist anywhere on earth.
  const fs = DATA.firms.find((f) => f.id === 'fundedseat');
  assert.match(fs.promo.label, /45% OFF \+ 50% w\/ code/, 'the label under test changed');

  const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });
  const rendered = [renderTweet(d), renderDiscord(d), renderEmail(d, {}).text, renderEmail(d, {}).html].join('\n');

  for (const forbidden of ['95%', '95 %']) {
    assert.ok(!rendered.includes(forbidden), `${forbidden} appeared in a message`);
  }
  // The only discount stated is the one computed from that plan's two prices.
  const claims = [...rendered.matchAll(/(\d+)\s*%\s*off/gi)].map((m) => m[1]);
  assert.deepEqual([...new Set(claims)], ['45'], `claims found: ${claims.join(', ')}`);
  assert.equal(d.headline.discountPct, Math.round((1 - 104.95 / 190) * 100));
});

test("the firm's own promo text never reaches a message", () => {
  // It is free marketing prose ("45% OFF + 50% w/ code ULTRA50") and it moves
  // without warning, so it is deliberately not a placeholder.
  let checked = 0;
  for (const firm of DATA.firms) {
    if (!firm.promo?.label) continue;
    const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!d) continue; // held back today (a failed scrape): nothing is rendered for it
    checked++;
    const rendered = [renderTweet(d), renderDiscord(d), renderEmail(d, {}).html].join('\n');
    assert.ok(!rendered.includes(firm.promo.label), `${firm.id}: the promo label leaked into a message`);
  }
  assert.ok(checked >= 2, `only ${checked} firms rendered: this test would pass on nothing`);
});

test('a percentage typed by hand into the copy file is refused', () => {
  useCopy(
    SHIPPED.replace(
      '## email.sub\n[{discount}% off on the {plan} plan.]',
      '## email.sub\n[{discount}% off, and 50% off with the code.]'
    ),
    TAKES
  );
  const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });
  const email = renderEmail(d, {});
  const problems = auditDiscountClaims(d, { email: email.text });
  assert.equal(problems.length, 1, `expected one problem, got ${problems.length}`);
  assert.match(problems[0], /claims "50% off"/);
  assert.match(problems[0], /only discount computed from the data is 45%/);
});

test('the shipped copy passes the audit on every firm', () => {
  for (const firm of DATA.firms) {
    const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!d) continue;
    const email = renderEmail(d, {});
    assert.deepEqual(
      auditDiscountClaims(d, {
        subject: email.subject,
        email: email.text,
        discord: renderDiscord(d),
        tweet: renderTweet(d),
      }),
      [],
      `${firm.id} failed the audit`
    );
  }
});

// ── his code, not theirs ─────────────────────────────────────────────────────

const PUBLIC_CODES = { 'blue-guardian': 'BG25', 'top-one-futures': 'BOGO', fundedseat: 'ULTRA50', 'legends-trading': 'LTG' };

test('no message ever prints a firm public code', () => {
  let checked = 0;
  for (const [firmId, publicCode] of Object.entries(PUBLIC_CODES)) {
    const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firmId });
    if (!d) continue; // held back today (a failed scrape): nothing is rendered for it
    checked++;
    const rendered = [renderTweet(d), renderDiscord(d), renderEmail(d, {}).html, renderEmail(d, {}).text].join('\n');
    assert.ok(
      !new RegExp(`(^|[^A-Za-z0-9])${publicCode.replace('.', '\\.')}([^A-Za-z0-9]|$)`).test(rendered),
      `${firmId}: printed the public code ${publicCode}`
    );
  }
  assert.ok(checked >= 2, `only ${checked} firms rendered: this test would pass on nothing`);
});

test('every firm prints JTNQ today, the same as the comparison page', () => {
  for (const firm of DATA.firms) {
    const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!d) continue;
    // codes.md has traders-launch on "link": no code typed, the link does it.
    if (firm.id === 'traders-launch') {
      assert.equal(d.code, null);
      assert.match(renderEmail(d, {}).html, /discount rides on the link/);
      continue;
    }
    assert.equal(d.code, 'JTNQ', `${firm.id} prints ${d.code}`);
    assert.match(renderTweet(d), /Code JTNQ:/);
  }
});

test('a code declared in codes.md is the one that gets printed', () => {
  useCopy(SHIPPED, TAKES, '## codes\nlegends-trading = LTG\n');
  const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'legends-trading' });
  assert.equal(d.code, 'LTG');
  assert.match(renderTweet(d), /Code LTG:/);
  // Declared on purpose, so the audit must not fight it.
  assert.deepEqual(auditCodeClaims(d, { tweet: renderTweet(d) }), []);
});

test('an undeclared firm falls back to JTNQ and says so', () => {
  useCopy(SHIPPED, TAKES, '## codes\ntradeday = JTNQ\n');
  const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });
  assert.equal(d.code, 'JTNQ');
  assert.equal(d.codeUndeclared, true);

  const declared = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'tradeday' });
  assert.equal(declared.codeUndeclared, false);
});

test('a public code typed by hand into the copy file is refused', () => {
  useCopy(
    SHIPPED.replace('## email.code\nCode at checkout: {code}', '## email.code\nCode at checkout: {code} or ULTRA50'),
    TAKES,
    '## codes\nfundedseat = JTNQ\n'
  );
  const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });
  const email = renderEmail(d, {});
  const problems = auditCodeClaims(d, { html: email.html });
  assert.equal(problems.length, 1, `expected one problem, got ${problems.length}`);
  assert.match(problems[0], /prints the public code "ULTRA50" instead of "JTNQ"/);
});

test('"link" prints no code at all', () => {
  useCopy(SHIPPED, TAKES, '## codes\nfundedseat = link\n');
  const d = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });
  assert.equal(d.code, null);
  const email = renderEmail(d, {});
  assert.ok(!email.html.includes('Code at checkout'), 'a code line survived');
  assert.match(email.html, /discount rides on the link/);
  assert.match(renderTweet(d), /Discount is already on the link/);
});

test('the shipped file passes its own completeness check', () => {
  const { messages } = loadCopy();
  assert.equal(assertComplete(messages), true);
  assert.equal(parseLabels(messages['email.labels']).maxdd, 'Max drawdown');
});
