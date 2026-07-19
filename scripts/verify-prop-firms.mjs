// Prop-firms comparator verification harness — DOM must match public/data/prop-firms.json.
// Usage:  npm run build && (python3 -m http.server 8788 --directory out &) && node scripts/verify-prop-firms.mjs
// Env:    PORT (default 8788), SHOT_DIR (default /tmp) for screenshots.
const WT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(WT + '/public/data/prop-firms.json', 'utf8'));
const OUT = process.env.SHOT_DIR || '/tmp';

const money = (n) => '$' + n.toLocaleString('en-US', Number.isInteger(n) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sizeLabel = (n) => '$' + n / 1000 + 'K';
let failures = 0;
const check = (label, cond, detail) => {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label + (cond ? '' : '  [' + detail + ']'));
  if (!cond) failures++;
};

function cheapest(firm, mode, size) {
  const cands = firm.programs
    .filter((p) => p.type === mode)
    .map((p) => ({ program: p, plan: p.plans.find((pl) => pl.size === size) }))
    .filter((c) => c.plan)
    .sort((a, b) => a.plan.price - b.plan.price);
  return cands.length ? { ...cands[0], count: cands.length } : null;
}

async function readRow(page, firmName) {
  const row = page.locator('tr.firm-row', { has: page.locator(`.firm-row-name:text-is("${firmName}")`) });
  const cell = async (cls) => {
    const l = row.locator('.' + cls);
    return (await l.count()) ? (await l.first().innerText()).replace(/\s+/g, ' ').trim() : null;
  };
  return {
    row,
    price: await cell('cell-price'),
    target: await cell('cell-target'),
    loss: await cell('cell-loss'),
    daily: await cell('cell-daily'),
    noplan: await cell('row-noplan') ?? ((await row.innerText()).includes('No ' ) && /available:/.test(await row.innerText()) ? (await row.innerText()).replace(/\s+/g, ' ') : null),
    cta: (await row.locator('.row-cta').innerText()).replace(/\s+/g, ' ').trim(),
    text: (await row.innerText()).replace(/\s+/g, ' ').trim(),
  };
}

function effPrice(firm, plan) {
  if (firm.codeDiscountPct != null && plan.originalPrice == null)
    return { now: plan.price * (1 - firm.codeDiscountPct / 100), was: plan.price };
  return { now: plan.price, was: plan.originalPrice };
}

function expectRow(r, c, firm, label) {
  const { plan, count } = c;
  const eff = effPrice(firm, plan);
  check(label + ': price', r.price.includes(money(eff.now)), r.price + ' vs ' + money(eff.now));
  check(label + ': from prefix', /\bfrom\b/i.test(r.price) === (count > 1), r.price);
  if (eff.was != null) check(label + ': was price', r.price.includes(money(eff.was)), r.price);
  check(label + ': activation subline', plan.activationFee != null
    ? r.price.includes(money(plan.activationFee)) : !/activation/i.test(r.price), r.price);
  check(label + ': target', plan.profitTarget != null
    ? r.target.includes(money(plan.profitTarget)) : /None/.test(r.target), r.target);
  check(label + ': max loss', r.loss.includes(money(plan.maxDrawdown)), r.loss);
  const ddLabel = { EOD: 'No trail', 'EOD Trailing': 'EOD Trail', Intraday: 'Intraday Trail' }[plan.ddType];
  check(label + ': dd tag', r.loss.toLowerCase().includes(ddLabel.toLowerCase()), r.loss + ' vs ' + ddLabel);
  check(label + ': daily loss', plan.dailyLoss != null
    ? r.daily.includes(money(plan.dailyLoss)) : /None/.test(r.daily), r.daily);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://localhost:${process.env.PORT || 8788}/prop-firms/`, { waitUntil: 'networkidle' });
  const globalPill = (s) => page.locator('.size-pills button.pill', { hasText: sizeLabel(s) });

  // 1. Default eval @100K: one compact row per firm, cheapest plan, CTA code rules
  const evalFirms = data.firms.filter((f) => f.programs.some((p) => p.type === 'eval'));
  check(`${evalFirms.length} firm rows (eval)`,
    (await page.locator('tr.firm-row').count()) === evalFirms.length,
    await page.locator('tr.firm-row').count());
  check('old per-plan table gone', (await page.locator('text=COMPARE EVERY PLAN').count()) === 0, '');
  for (const firm of evalFirms) {
    const c = cheapest(firm, 'eval', 100000);
    const r = await readRow(page, firm.name);
    expectRow(r, c, firm, `${firm.name} @100K`);
    check(`${firm.name}: uniform CTA`, r.cta === 'Get funded', r.cta);
    check(`${firm.name}: plans counter`, /\d+ plans?/i.test(r.text), r.text.slice(0, 80));
  }
  check('legend present', (await page.locator('.legend').count()) === 1, '');
  const innerScroll = await page.evaluate(() => {
    const w = document.querySelector('.table-wrap');
    return w.scrollWidth - w.clientWidth;
  });
  check('no inner table scroll @1440', innerScroll <= 0, innerScroll + 'px');
  await page.screenshot({ path: OUT + '/v7-desktop-default.png', fullPage: true });

  // 2. Expand Blue Guardian: one sub-row per eval program at 100K, program details present
  const wrapHeights = () =>
    page.evaluate(() => [...document.querySelectorAll('.expand-wrap')].map((w) => w.offsetHeight));
  check('all expand panels collapsed by default', (await wrapHeights()).every((h) => h === 0),
    JSON.stringify(await wrapHeights()));
  const bg = data.firms.find((f) => f.id === 'blue-guardian');
  const bgRow = (await readRow(page, bg.name)).row;
  await bgRow.locator('.row-expand-btn').click();
  await page.waitForTimeout(350);
  const bgPanel = bgRow.locator('xpath=following-sibling::tr[1]').locator('.expand-panel');
  const bgProgs = bg.programs.filter((p) => p.type === 'eval' && p.plans.some((pl) => pl.size === 100000));
  const openHeights = await wrapHeights();
  check('expand: exactly one panel open', openHeights.filter((h) => h > 0).length === 1,
    JSON.stringify(openHeights));
  const subCount = await bgPanel.locator('.sub-row').count();
  check('expand: sub-row per program', subCount === bgProgs.length, subCount + ' vs ' + bgProgs.length);
  for (const p of bgProgs) {
    const plan = p.plans.find((pl) => pl.size === 100000);
    const sub = bgPanel.locator('.sub-row', { hasText: p.name });
    const txt = (await sub.count()) ? (await sub.first().innerText()).replace(/\s+/g, ' ') : '';
    check(`expand ${p.name}: price+consistency+contracts`,
      txt.includes(money(plan.price)) && txt.includes(plan.consistency) && txt.includes(plan.contracts),
      txt.slice(0, 160));
  }
  await page.screenshot({ path: OUT + '/v7-desktop-expanded.png', fullPage: false });

  // 3. Global size drives rows: $25K (TL has none), $200K (only TL + E8)
  for (const testSize of [25000, 200000]) {
    await globalPill(testSize).click();
    const withPlan = evalFirms.filter((f) => cheapest(f, 'eval', testSize));
    const rowCount = await page.locator('tr.firm-row').count();
    check(`rows @${sizeLabel(testSize)} = ${withPlan.length}`, rowCount === withPlan.length, rowCount);
    for (const firm of evalFirms) {
      const c = cheapest(firm, 'eval', testSize);
      if (c) expectRow(await readRow(page, firm.name), c, firm, `${firm.name} @${sizeLabel(testSize)}`);
      else
        check(`${firm.name} @${sizeLabel(testSize)}: row hidden`,
          (await page.locator(`.firm-row-name:text-is("${firm.name}")`).count()) === 0, 'row still present');
    }
  }
  await page.screenshot({ path: OUT + '/v7-desktop-200k.png', fullPage: false });
  await globalPill(100000).click();

  // 4. Expand persists across size changes and its content follows the current size
  await page.waitForTimeout(350);
  const openCount = (await wrapHeights()).filter((h) => h > 0).length;
  check('expand persists after size changes', openCount === 1, JSON.stringify(await wrapHeights()));
  const bgPanel2 = bgRow.locator('xpath=following-sibling::tr[1]').locator('.expand-panel');
  const bg100 = bg.programs
    .filter((p) => p.type === 'eval')
    .flatMap((p) => p.plans.filter((pl) => pl.size === 100000));
  const panelTxt = (await bgPanel2.innerText()).replace(/\s+/g, ' ');
  check('expand content follows current size', bg100.every((pl) => panelTxt.includes(money(pl.price))),
    panelTxt.slice(0, 140));

  // 5. Instant mode rows
  await page.locator('button.mode', { hasText: 'Instant funding' }).click();
  const instFirms = data.firms.filter((f) => f.programs.some((p) => p.type === 'instant'));
  const instRows = await page.locator('tr.firm-row').count();
  check(`instant mode rows = ${instFirms.length}`, instRows === instFirms.length, instRows);
  for (const firm of instFirms) {
    const c = cheapest(firm, 'instant', 100000);
    const r = await readRow(page, firm.name);
    expectRow(r, c, firm, `${firm.name} instant @100K`);
  }

  // 6. Mobile: stacked cards, no horizontal scroll, labels, full-width CTA
  await page.locator('button.mode', { hasText: 'Evaluation' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no page overflow @390px', overflow <= 0, 'overflowX=' + overflow + 'px');
  const mob = await page.evaluate(() => {
    const thead = document.querySelector('thead');
    const row = document.querySelector('tr.firm-row');
    const cta = row.querySelector('.row-cta');
    return {
      theadHidden: !thead || thead.offsetHeight === 0,
      rowW: row.getBoundingClientRect().width,
      ctaW: cta.getBoundingClientRect().width,
      labels: document.querySelectorAll('td[data-label]').length,
      heroTop: document.querySelector('.table-section, .table-wrap').getBoundingClientRect().top + window.scrollY,
    };
  });
  check('mobile: thead hidden', mob.theadHidden, JSON.stringify(mob));
  check('mobile: card row ~full width', mob.rowW >= 330, mob.rowW + 'px');
  check('mobile: CTA full width', mob.ctaW >= mob.rowW * 0.8, mob.ctaW + ' vs row ' + mob.rowW);
  check('mobile: data-labels present', mob.labels >= evalFirms.length * 4, mob.labels);
  check('mobile: comparator starts above ~900px', mob.heroTop < 900, mob.heroTop + 'px');
  await page.screenshot({ path: OUT + '/v7-mobile.png', fullPage: true });

  await browser.close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})();
