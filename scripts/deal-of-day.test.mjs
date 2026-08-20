// Red-first tests for the daily prop-firm deal engine.
// Run: node --test scripts/deal-of-day.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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

test('an activation fee beats a headline percentage', () => {
  // Top One Elite Access 50K is $39 with a $189 activation fee: $228 to get
  // funded, more than the $218 it strikes through while claiming 82% off.
  // Elite Daily is $98 all in. The cheaper path wins even though it shows a
  // smaller percentage.
  const deal = pickDeal(DATA, { today: '2026-09-30', history: [], forceFirmId: 'top-one-futures' });
  assert.equal(deal.programLabel, 'Elite Daily');
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.headline.price, 98);
  assert.equal(deal.headline.discountPct, 55);
  assert.equal(deal.rules.activationFee, null);
});

test('the cheapest path to funded is what gets picked, fees included', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const size = deal.headline.size;
    // Same effective price the engine uses: a firm with codeDiscountPct and no
    // struck price is discounted by the code (Traders Launch, -15%).
    const effective = (pl) =>
      firm.codeDiscountPct != null && pl.originalPrice == null
        ? Math.round(pl.price * (1 - firm.codeDiscountPct / 100) * 100) / 100
        : pl.price;
    const cheapest = Math.min(
      ...firm.programs.flatMap((p) =>
        p.plans.filter((pl) => pl.size === size).map((pl) => effective(pl) + (pl.activationFee ?? 0))
      )
    );
    const picked = deal.headline.price + (deal.rules.activationFee ?? 0);
    assert.equal(picked, cheapest, `${firm.id}: picked ${picked}, cheapest at that size is ${cheapest}`);
  }
});

test('the reference size wins over a bigger percentage elsewhere', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const sizes = new Set(firm.programs.flatMap((p) => p.plans.map((pl) => pl.size)));
    const expected = sizes.has(50000)
      ? 50000
      : [...sizes].reduce((a, b) => (Math.abs(b - 50000) < Math.abs(a - 50000) ? b : a));
    assert.equal(deal.headline.size, expected, `${firm.id} headlined ${deal.headline.size}`);
  }
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

    if (c.headline.discountSource === 'firm.codeDiscountPct') {
      // Same rule as the comparison page: the affiliate code comes off the
      // listed price, which becomes the struck-through one.
      assert.equal(c.headline.price, Math.round(plan.price * (1 - firm.codeDiscountPct / 100) * 100) / 100);
      assert.equal(c.headline.originalPrice, plan.price);
    } else {
      assert.equal(c.headline.price, plan.price);
      assert.equal(c.headline.originalPrice, plan.originalPrice);
    }
  }
});

test('a firm priced by affiliate code shows the same price as the site', () => {
  // Traders Launch has no struck price in the data, it has codeDiscountPct 15,
  // and app/prop-firms/page.tsx renders $135.15 instead of $159 for the 100K.
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'traders-launch' });
  assert.equal(deal.headline.size, 100000);
  assert.equal(deal.headline.price, 135.15);
  assert.equal(deal.headline.originalPrice, 159);
  assert.equal(deal.headline.discountPct, 15);
  assert.match(renderTweet(deal), /\$135\.15 for a 100K challenge, instead of \$159/);
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

test('LEGENDS leads with Elite, the plan with no activation fee', () => {
  // Apprentice shows 80% off at $37/mo but charges $99 once you pass: $136 to
  // get funded. Elite shows 35% off at $96.85 and charges nothing after. The
  // reference size stays the 50K, the plan is the one that costs less all in.
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'legends-trading' });
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.programLabel, 'Elite');
  assert.equal(deal.headline.price, 96.85);
  assert.equal(deal.rules.activationFee, null);
  assert.equal(deal.priceType, 'one-time');
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

test('a scraped value never drags an interpunct into a sentence', () => {
  // "Daily · 5h guaranteed" is fine in a table and wrong mid-sentence. The
  // separators the copy file itself uses are Angelo's call, not this test's.
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const tweet = renderTweet(deal);
    assert.ok(!tweet.includes('·'), `${firm.id}: interpunct in tweet\n${tweet}`);
  }
  const fundedseat = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'fundedseat' });
  assert.match(renderTweet(fundedseat), /payout Daily, 5h guaranteed/);
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

// ── images ───────────────────────────────────────────────────────────────────

test('every firm has an email-safe raster logo that exists on disk', () => {
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    assert.equal(
      deal.logo,
      `https://jacktradesnq.com/logos/email/${firm.id}.png`,
      `${firm.id}: unexpected logo url`
    );
    // SVG is stripped by Gmail, so the email set has to be PNG and has to exist.
    const onDisk = new URL(`../public/logos/email/${firm.id}.png`, import.meta.url);
    assert.ok(existsSync(onDisk), `${firm.id}: public/logos/email/${firm.id}.png missing`);
  }
});

test('the email shows the logo once, sized and described', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const { html } = renderEmail(deal, {});
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  assert.equal(imgs.length, 1, `expected one image, got ${imgs.length}`);
  const [img] = imgs;
  assert.match(img, /src="https:\/\/jacktradesnq\.com\/logos\/email\/fundedseat\.png"/);
  assert.match(img, /width="48"/);
  assert.match(img, /height="48"/);
  assert.match(img, /alt="FundedSeat"/);
});

// ── spacing ──────────────────────────────────────────────────────────────────

test('every spacing value sits on the 4pt grid', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const { html } = renderEmail(deal, {});
  const offenders = [];
  for (const [, prop, value] of html.matchAll(/(padding|margin)(?:-[a-z]+)?:([^;"]+)/g)) {
    for (const px of value.matchAll(/(\d+)px/g)) {
      if (Number(px[1]) % 4 !== 0) offenders.push(`${prop}: ${px[1]}px`);
    }
  }
  assert.deepEqual(offenders, [], `off-grid spacing: ${offenders.join(', ')}`);
});

// ── wording ──────────────────────────────────────────────────────────────────

test('an evaluation is called a challenge, instant funding is called funded', () => {
  const evalDeal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'tradeday' });
  assert.equal(evalDeal.programType, 'eval');
  assert.match(renderTweet(evalDeal), /50K challenge/);
  assert.doesNotMatch(renderTweet(evalDeal), /funded account/);

  // No firm currently headlines an instant program, so strip a firm down to one
  // to prove the wording follows program.type and not the firm.
  const data = structuredClone(DATA);
  const bg = data.firms.find((f) => f.id === 'blue-guardian');
  bg.programs = bg.programs.filter((p) => p.type === 'instant');
  const instant = pickDeal(data, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  assert.equal(instant.programType, 'instant');
  assert.match(renderTweet(instant), /instant funded account/);
  assert.doesNotMatch(renderTweet(instant), /challenge/);
});

test('the drawdown type is stated once, not twice', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const { html } = renderEmail(deal, {});
  const hits = html.match(/EOD Trailing/g) ?? [];
  assert.equal(hits.length, 1, `"EOD Trailing" appears ${hits.length} times`);
});

test('the button says what it costs', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [] });
  const { html } = renderEmail(deal, {});
  const cta = html.match(/<a href="[^"]*"[^>]*>([^<]+)<\/a>/)?.[1] ?? '';
  assert.match(cta, /Get the 50K at \$104\.95/, `cta reads "${cta}"`);
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
