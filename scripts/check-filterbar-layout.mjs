// Filter bar layout check — no button of the study filter bar may overlap another one,
// and the bar (sticky strip included) must stay inside the screen.
// Usage:  npm run build && (python3 -m http.server 8788 --directory out &) && node scripts/check-filterbar-layout.mjs
// Env:    BASE (default http://localhost:8788) — point it at https://jacktradesnq.com to check the live site.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8788';
const SLUGS = ['cpi-ifvg-smt', 'nfp-ifvg-smt-gc', 'si-ifvg-smt', 'es-ifvg-smt', 'fomc-ifvg-smt', 'joblessclaims-ifvg-smt-es', 'globex-ib50-es'];
// Default filters, then a non-default one so the Reset button shows too.
const QUERIES = ['?mode=advanced', '?mode=advanced&lookback=1y'];
const WIDTHS = [360, 390, 430, 600, 640, 768, 1024, 1440];

let failures = 0;
let checked = 0;
const browser = await chromium.launch();
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const slug of SLUGS) {
    for (const q of QUERIES) {
      await page.goto(`${BASE}/studies/${slug}/${q}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const bar = document.querySelector('.fb-bar');
        if (!bar) return null;
        const els = [...bar.querySelectorAll('.fb-pill, .fb-best, .fb-reset, .fb-group-label')]
          .filter((e) => e.offsetParent !== null)
          .map((e) => ({ t: e.textContent.trim(), b: e.getBoundingClientRect() }));
        const hits = [];
        for (let i = 0; i < els.length; i++) {
          for (let j = i + 1; j < els.length; j++) {
            const a = els[i].b, c = els[j].b;
            const w = Math.min(a.right, c.right) - Math.max(a.left, c.left);
            const h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
            if (w > 1 && h > 1) hits.push(`« ${els[i].t} » / « ${els[j].t} »`);
          }
        }
        const outside = els.filter((e) => e.b.right > window.innerWidth + 0.5 || e.b.left < -0.5).map((e) => e.t);
        const wrap = (bar.closest('.fb-sticky-wrap') || bar).getBoundingClientRect();
        const bleed = Math.max(0, Math.round(wrap.right - window.innerWidth), Math.round(-wrap.left));
        return { hits, outside, bleed };
      });
      if (!r) continue;
      checked++;
      const bad = r.hits.length || r.outside.length || r.bleed > 0;
      if (bad) {
        failures++;
        console.log(`FAIL ${width}px ${slug}${q}`
          + (r.hits.length ? `  chevauchement: ${r.hits.join(', ')}` : '')
          + (r.outside.length ? `  hors ecran: ${r.outside.join(', ')}` : '')
          + (r.bleed > 0 ? `  barre plus large que l'ecran de ${r.bleed}px` : ''));
      }
    }
  }
  await page.close();
}
await browser.close();
if (!checked) {
  console.log('FAIL — aucune barre de filtres trouvee (site servi ?)');
  process.exit(1);
}
console.log(failures ? `${failures} FAIL sur ${checked} barres verifiees` : `ALL CHECKS PASSED (${checked} barres verifiees)`);
process.exit(failures ? 1 : 0);
