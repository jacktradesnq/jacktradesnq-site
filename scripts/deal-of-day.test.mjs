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

// Frozen data on purpose. These tests are about how a deal RENDERS, and the
// published file is rewritten every morning by the price sync: the day a
// scrape marked a firm stale, seventeen of these went red on main without a
// line of code changing. Freshness of the live file is checked beside the
// scrapers, where it belongs.
const DATA = JSON.parse(readFileSync(new URL('./fixtures/prop-firms.fixture.json', import.meta.url), 'utf8'));

// ── selection ────────────────────────────────────────────────────────────────

test('a firm whose promo expires within 96h wins over a bigger discount', () => {
  // Injected on a kept firm: its standing discount is smaller than another's,
  // and the end date is what puts it first. The winner must be the soonest to end.
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'blue-guardian');
  firm.promo = { ...firm.promo, ends: '2026-08-23' };
  const deal = pickDeal(data, { today: '2026-08-20', history: [] });
  assert.ok(deal.signals.includes('expiring'), `${deal.firmId} signals=${deal.signals}`);
  assert.ok(deal.hoursLeft > 0 && deal.hoursLeft <= 96, `hoursLeft=${deal.hoursLeft}`);

  const expiring = analyzeFirms(data, { today: '2026-08-20' }).filter((c) => c.signals.includes('expiring'));
  const soonest = expiring.reduce((a, b) => (b.hoursLeft < a.hoursLeft ? b : a));
  assert.equal(deal.firmId, soonest.firmId);
});

test('an activation fee beats a headline percentage', () => {
  // A $39 headline plus a $189 activation is $228 to get funded, more than a
  // $98 plan with nothing after. The cheaper path wins even though it shows a
  // smaller percentage. Injected on a kept firm so the test pins the engine,
  // not a partnership that no longer exists.
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'e8-markets');
  firm.stale = false;
  const base = firm.programs[0].plans.find((pl) => pl.size === 50000);
  firm.programs = [
    {
      name: 'Headline Cheap',
      type: 'eval',
      priceType: 'one-time',
      plans: [{ ...base, price: 39, originalPrice: 218, activationFee: 189 }],
    },
    {
      name: 'All In',
      type: 'eval',
      priceType: 'one-time',
      plans: [{ ...base, price: 98, originalPrice: 218, activationFee: null }],
    },
  ];
  const deal = pickDeal(data, { today: '2026-09-30', history: [], forceFirmId: 'e8-markets' });
  assert.equal(deal.programLabel, 'All In');
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.headline.price, 98);
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
    history: [{ firmId: 'blue-guardian', date: '2026-08-20' }],
  });
  // Which firm comes second is incidental, it follows the discounts of the day.
  // What matters is that the one already sent is skipped, and that the runner-up
  // is the best of the firms still eligible.
  assert.notEqual(deal.firmId, 'blue-guardian');
  const eligible = analyzeFirms(DATA, { today: '2026-08-21' }).filter((c) => c.firmId !== 'blue-guardian');
  assert.equal(deal.firmId, eligible[0].firmId);
});

test('a week of sends never sends the same firm twice', () => {
  // How many firms a week can cover is the feed's call, not a number typed
  // here: a firm whose scrape failed is held back, and the rotation shrinks
  // with it. Asserting 7 was asserting yesterday's feed.
  const eligible = analyzeFirms(DATA, { today: '2026-08-20' }).length;
  assert.ok(eligible >= 3, `only ${eligible} firms eligible, the week would repeat`);
  const history = [];
  const picked = [];
  for (let i = 0; i < eligible; i++) {
    const today = new Date(Date.UTC(2026, 7, 20 + i)).toISOString().slice(0, 10);
    const deal = pickDeal(DATA, { today, history });
    assert.ok(deal, `no deal on ${today}`);
    picked.push(deal.firmId);
    history.push({ firmId: deal.firmId, date: today });
  }
  assert.equal(new Set(picked).size, eligible, `picked=${picked.join(',')}`);
});

test('a stale firm is never headlined (its promo may already be dead)', () => {
  const data = structuredClone(DATA);
  for (const f of data.firms) f.stale = f.id === 'e8-markets';
  const deal = pickDeal(data, { today: '2026-09-30', history: [] });
  assert.notEqual(deal.firmId, 'e8-markets');
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
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  const msg = renderDiscord(deal);
  assert.ok(msg.length <= 2000, `${msg.length} chars`);
  assert.ok(msg.includes(deal.firmName));
  assert.ok(msg.includes(deal.url));
  assert.ok(msg.includes(String(deal.headline.price)));
});

test('email carries subject, real prices, the code, and an unsubscribe slot', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
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

test('the plan with no activation fee wins when it is cheaper all in', () => {
  // A monthly 80% off at $37 plus a $99 fee is $136 to get funded. A one-time
  // 35% off at $96.85 with nothing after is the cheaper path. Same arbitration
  // as the headline-percentage test, on a kept firm.
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'blue-guardian');
  const base = firm.programs[0].plans.find((pl) => pl.size === 50000);
  firm.programs = [
    {
      name: 'Apprentice Path',
      type: 'eval',
      priceType: 'monthly',
      plans: [{ ...base, price: 37, originalPrice: 185, activationFee: 99 }],
    },
    {
      name: 'Elite Path',
      type: 'eval',
      priceType: 'one-time',
      plans: [{ ...base, price: 96.85, originalPrice: 149, activationFee: null }],
    },
  ];
  const deal = pickDeal(data, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  assert.equal(deal.headline.size, 50000);
  assert.equal(deal.programLabel, 'Elite Path');
  assert.equal(deal.rules.activationFee, null);
  assert.equal(deal.priceType, 'one-time');
  assert.equal(deal.headline.price, 96.85);
});

test('a monthly plan marks BOTH prices per month, never just the new one', () => {
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'e8-markets');
  for (const p of firm.programs) p.priceType = 'monthly';
  const deal = pickDeal(data, { today: '2026-08-20', history: [], forceFirmId: 'e8-markets' });
  assert.equal(deal.priceType, 'monthly');
  const tweet = renderTweet(deal);
  const mail = renderEmail(deal, {});
  // [\d.]+ must be pinned, otherwise it backtracks and the lookahead passes on "$13|1/mo".
  assert.doesNotMatch(tweet, /\/mo instead of \$[\d.]+(?![\d.]|\/mo)/, `original price not marked /mo:\n${tweet}`);
  assert.match(mail.text, /\/mo.*was.*\/mo/s);
});

test('a scraped value never drags an interpunct into a sentence', () => {
  // A scraped "On-demand · same day" is fine in a table and wrong mid-sentence.
  // The separators the copy file itself uses are Angelo's call, not this test's.
  for (const firm of DATA.firms) {
    const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: firm.id });
    if (!deal) continue;
    const tweet = renderTweet(deal);
    assert.ok(!tweet.includes('·'), `${firm.id}: interpunct in tweet\n${tweet}`);
  }
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'blue-guardian');
  firm.payout = 'On-demand · same day';
  const kept = pickDeal(data, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  assert.match(renderTweet(kept), /payout On-demand, same day/);
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
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  const { html } = renderEmail(deal, {});
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  assert.equal(imgs.length, 1, `expected one image, got ${imgs.length}`);
  const [img] = imgs;
  assert.match(img, /src="https:\/\/jacktradesnq\.com\/logos\/email\/blue-guardian\.png"/);
  assert.match(img, /width="48"/);
  assert.match(img, /height="48"/);
  assert.match(img, /alt="Blue Guardian"/);
});

test('the logo is served cross-origin, or it shows up broken in an inbox', () => {
  // The site sends Cross-Origin-Resource-Policy: same-origin on /*, which is
  // exactly what an email does: load the image from another origin. Measured
  // in a browser: ERR_BLOCKED_BY_RESPONSE.NotSameOrigin. Gmail proxies the
  // image server-side and never sees it, Outlook web does.
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const rule = headers.split(/\n(?=\/)/).find((block) => block.startsWith('/logos/email/*'));
  assert.ok(rule, 'no /logos/email/* block in public/_headers');
  assert.match(rule, /Cross-Origin-Resource-Policy:\s*cross-origin/);
});

// ── spacing ──────────────────────────────────────────────────────────────────

test('every spacing value sits on the 4pt grid', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
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
  const evalDeal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
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
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  const { html } = renderEmail(deal, {});
  const hits = html.match(/EOD Trailing/g) ?? [];
  assert.equal(hits.length, 1, `"EOD Trailing" appears ${hits.length} times`);
});

test('the button says what it costs', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  const { html } = renderEmail(deal, {});
  const cta = html.match(/<a href="[^"]*"[^>]*>([^<]+)<\/a>/)?.[1] ?? '';
  assert.match(cta, /Get the 50K at \$116/, `cta reads "${cta}"`);
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
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
  const { html } = renderEmail(deal, {});
  assert.ok(html.includes('#02130C'), 'warm black surface missing');
  assert.ok(html.includes('#E9B44B'), 'gold accent missing');
  assert.ok(!/#FBF6EC|#FFFFFF;?\s*(?:border|border-radius)/.test(html), 'cream card still there');
});

test('the email carries the numbers a trader decides on', () => {
  const deal = pickDeal(DATA, { today: '2026-08-20', history: [], forceFirmId: 'blue-guardian' });
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
  const data = structuredClone(DATA);
  const firm = data.firms.find((f) => f.id === 'e8-markets');
  for (const p of firm.programs) p.priceType = 'monthly';
  const monthly = pickDeal(data, { today: '2026-08-20', history: [], forceFirmId: 'e8-markets' });
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
