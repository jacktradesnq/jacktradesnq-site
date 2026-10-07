// Mobile width check — no studies page may be wider than a phone screen (no sideways scroll).
// Every /studies/ page from the sitemap (+ hub, basics, calendar, methodology), simple and
// advanced mode, at 360 / 390 / 430px. Names the deepest elements that stick out.
// Usage:  npm run build && (python3 -m http.server 8788 --directory out &) && node scripts/check-page-width.mjs
// Env:    BASE (default http://localhost:8788) — point it at https://jacktradesnq.com to check the live site.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8788';
const WIDTHS = [360, 390, 430];

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const fromSitemap = [...sitemap.matchAll(/<loc>[^<]*?(\/studies\/[^<]*)<\/loc>/g)].map((m) => m[1]);
const paths = [...new Set(['/studies/', '/studies/basics/', '/studies/calendar/', '/studies/methodology/', ...fromSitemap])];
const jobs = [];
for (const p of paths) for (const q of ['', '?mode=advanced']) for (const w of WIDTHS) jobs.push({ url: p + q, w });

const browser = await chromium.launch();
const failures = [];
let next = 0;
async function worker() {
  const pages = {};
  while (next < jobs.length) {
    const { url, w } = jobs[next++];
    pages[w] ??= await browser.newPage({ viewport: { width: w, height: 900 } });
    const page = pages[w];
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const W = window.innerWidth;
      const extra = document.documentElement.scrollWidth - W;
      if (extra <= 0) return null;
      const culprits = [];
      for (const e of document.querySelectorAll('body *')) {
        const rc = e.getBoundingClientRect();
        if (rc.width && rc.right > W + 0.5 && ![...e.children].some((c) => c.getBoundingClientRect().right > W + 0.5)) {
          culprits.push(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`);
        }
      }
      return { extra, culprits: [...new Set(culprits)].slice(0, 4) };
    });
    if (r) failures.push(`FAIL ${w}px ${url}  +${r.extra}px  ${r.culprits.join(', ')}`);
  }
}
await Promise.all([worker(), worker(), worker()]);
await browser.close();
failures.sort().forEach((f) => console.log(f));
console.log(failures.length ? `${failures.length} FAIL sur ${jobs.length} pages verifiees` : `ALL CHECKS PASSED (${jobs.length} pages verifiees)`);
process.exit(failures.length ? 1 : 0);
