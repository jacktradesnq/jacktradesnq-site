// Red-first tests for the daily prop-firm deal engine.
// Run: node --test scripts/deal-of-day.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  analyzeFirms,
  pickDeal,
  snapshotOf,
  renderEmail,
  renderDiscord,
  renderTweet,
} from './lib/deal-of-day.mjs';

const DATA = JSON.parse(readFileSync(new URL('../public/data/prop-firms.json', import.meta.url), 'utf8'));

// ── selection ────────────────────────────────────────────────────────────────

test('a firm whose promo expires within 96h wins over a bigger discount', () => {
  // FundedSeat promo ends 2026-08-23; Top One has the biggest raw discount (89%).
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  assert.equal(deal.firmId, 'fundedseat');
  assert.ok(deal.signals.includes('expiring'), `signals=${deal.signals}`);
  assert.ok(deal.hoursLeft > 0 && deal.hoursLeft <= 96, `hoursLeft=${deal.hoursLeft}`);
});

test('without urgency, the biggest real discount wins', () => {
  const deal = pickDeal(DATA, { today: '2026-09-30', history: [] }); // FundedSeat promo long expired
  assert.equal(deal.firmId, 'top-one-futures');
  assert.equal(deal.headline.discountPct, 89);
});

test('a firm sent in the last 7 days is not picked again', () => {
  const deal = pickDeal(DATA, {
    today: '2026-08-21',
    history: [{ firmId: 'fundedseat', date: '2026-08-20' }],
  });
  assert.notEqual(deal.firmId, 'fundedseat');
  assert.equal(deal.firmId, 'top-one-futures');
});

test('7 consecutive days rotate over 7 distinct firms', () => {
  const history = [];
  const picked = [];
  for (let i = 0; i < 7; i++) {
    const today = new Date(Date.UTC(2026, 7, 20 + i)).toISOString().slice(0, 10);
    const deal = pickDeal(DATA, { today, history });
    assert.ok(deal, `no deal on ${today}`);
    picked.push(deal.firmId);
    history.push({ firmId: deal.firmId, date: today });
  }
  assert.equal(new Set(picked).size, 7, `picked=${picked.join(',')}`);
});

test('a stale firm is never headlined (its promo may already be dead)', () => {
  const data = structuredClone(DATA);
  for (const f of data.firms) f.stale = f.id === 'top-one-futures';
  const deal = pickDeal(data, { today: '2026-09-30', history: [] });
  assert.notEqual(deal.firmId, 'top-one-futures');
});

test('a new promo since yesterday outranks a bigger standing discount', () => {
  const prevSnapshot = snapshotOf(DATA);
  const data = structuredClone(DATA);
  const bg = data.firms.find((f) => f.id === 'blue-guardian');
  bg.promo = { label: '60% OFF', code: 'BG60' };
  for (const p of bg.programs) for (const pl of p.plans) pl.price = Math.round(pl.originalPrice * 0.4);
  const deal = pickDeal(data, { today: '2026-09-30', history: [], prevSnapshot });
  assert.equal(deal.firmId, 'blue-guardian');
  assert.ok(deal.signals.includes('new-promo'), `signals=${deal.signals}`);
});

test('every figure in a candidate comes from the JSON, never computed prose', () => {
  const cands = analyzeFirms(DATA, { today: '2026-08-20' });
  for (const c of cands) {
    const firm = DATA.firms.find((f) => f.id === c.firmId);
    const program = firm.programs.find((p) => p.name === c.programName);
    assert.ok(program, `${c.firmId}: program ${c.programName} not in data`);
    const plan = program.plans.find((p) => p.size === c.headline.size);
    assert.ok(plan, `${c.firmId}: size ${c.headline.size} not in ${c.programName}`);
    assert.equal(c.headline.price, plan.price);
    assert.equal(c.headline.originalPrice, plan.originalPrice);
  }
});

// ── renderers ────────────────────────────────────────────────────────────────

test('tweet stays under 280 chars for every firm, with code and link', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const tweet = renderTweet(deal);
    const weighted = tweet.replace(/https?:\/\/\S+/g, 'x'.repeat(23));
    assert.ok(weighted.length <= 280, `${firm.id}: ${weighted.length} chars\n${tweet}`);
    assert.ok(tweet.includes(deal.url), `${firm.id}: link missing`);
    if (deal.code) assert.ok(tweet.includes(deal.code), `${firm.id}: code missing`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(tweet), `${firm.id}: emoji in tweet`);
    assert.ok(!tweet.includes('—'), `${firm.id}: em dash in tweet`);
  }
});

test('discord message fits the 2000 char limit and carries the offer', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const msg = renderDiscord(deal);
  assert.ok(msg.length <= 2000, `${msg.length} chars`);
  assert.ok(msg.includes(deal.firmName));
  assert.ok(msg.includes(deal.url));
  assert.ok(msg.includes(String(deal.headline.price)));
});

test('email carries subject, real prices, the code, and an unsubscribe slot', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const mail = renderEmail(deal, { generatedAt: DATA.generatedAt });
  assert.ok(mail.subject.length > 0 && mail.subject.length <= 70, `subject: ${mail.subject}`);
  assert.ok(mail.preheader.length > 0);
  assert.ok(mail.html.includes(String(deal.headline.price)));
  assert.ok(mail.html.includes(deal.url));
  assert.ok(mail.html.includes('{{unsubscribe_url}}'), 'no unsubscribe slot');
  assert.ok(!mail.html.includes('oklch'), 'oklch does not render in email clients');
  assert.ok(!/<script/i.test(mail.html), 'no script in email');
  assert.ok(mail.text.includes(deal.url), 'plain-text part must carry the link');
});

test('at equal discount the 50K account is the one put forward', () => {
  // LEGENDS Apprentice is 80% off on 25K, 50K and 100K alike: 50K is the size
  // traders actually compare, so that is the one the copy must lead with.
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'legends-trading' });
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.headline.discountPct, 80);
});

test('a monthly plan marks BOTH prices per month, never just the new one', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'tradeday' });
  assert.equal(deal.priceType, 'monthly');
  const tweet = renderTweet(deal);
  const mail = renderEmail(deal, {});
  // [\d.]+ must be pinned, otherwise it backtracks and the lookahead passes on "$13|1/mo".
  assert.doesNotMatch(tweet, /\/mo instead of \$[\d.]+(?![\d.]|\/mo)/, `original price not marked /mo:\n${tweet}`);
  assert.match(mail.text, /\/mo.*was.*\/mo/s);
});

test('no interpunct inside a sentence, it reads like a spreadsheet', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const tweet = renderTweet(deal);
    assert.ok(!tweet.includes('·'), `${firm.id}: interpunct in tweet\n${tweet}`);
    assert.ok(!renderEmail(deal, {}).text.includes('·'), `${firm.id}: interpunct in email text`);
  }
});

test('the program label never repeats the firm name', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const first = deal.firmName.split(/\s+/)[0].toLowerCase();
    assert.ok(
      !deal.programLabel.toLowerCase().startsWith(first),
      `${firm.id}: "${deal.firmName} ${deal.programLabel}" stutters`
    );
  }
});

test('email html is pure ASCII, a stray byte shows up as mojibake in clients', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const bad = renderEmail(deal, {}).html.match(/[^\x00-\x7F]/g);
    assert.equal(bad, null, `${firm.id}: non-ascii in html -> ${bad?.join(' ')}`);
  }
});

test('the email uses the site palette, warm black and gold, not cream', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const { html } = renderEmail(deal, {});
  assert.ok(html.includes('#02130C'), 'warm black surface missing');
  assert.ok(html.includes('#E9B44B'), 'gold accent missing');
  assert.ok(!/#FBF6EC|#FFFFFF;?\s*(?:border|border-radius)/.test(html), 'cream card still there');
});

test('the email carries the numbers a trader decides on', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'legends-trading' });
  const mail = renderEmail(deal, {});
  assert.ok(
    mail.html.includes(deal.rules.maxDrawdown.toLocaleString('en-US')),
    'max drawdown missing from the email'
  );
  if (deal.rules.profitTarget) {
    assert.ok(
      mail.html.includes(deal.rules.profitTarget.toLocaleString('en-US')),
      'profit target missing from the email'
    );
  }
});

test('the email states the catch when the data shows one, and invents none', () => {
  // TradeDay is billed monthly -> the catch must say so.
  const monthly = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'tradeday' });
  const mail = renderEmail(monthly, { generatedAt: DATA.generatedAt });
  assert.match(mail.html, /month/i);
  // Every caveat sentence must be traceable to a data field.
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    for (const c of deal.caveats) {
      assert.ok(c.source, `${firm.id}: caveat without a data source -> ${c.text}`);
    }
  }
});
