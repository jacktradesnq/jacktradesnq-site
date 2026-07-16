'use client';

import { useEffect, useMemo, useState } from 'react';

// Affiliate code applied on every firm link below.
const CODE = 'JTNQ';

// Prop firms JackTradesNQ is affiliated with (active JTNQ code).
// Every figure verified on each firm's own official site (July 2026).
// Affiliate links carry the JTNQ / referral attribution.
type Firm = {
  name: string;
  eval: string;
  split: number;
  funding: number; // max purchasable account, in $K, for numeric sort
  fundingLabel: string;
  drawdown: 'Trailing' | 'End-of-day';
  payout: string;
  url: string;
};

const FIRMS: Firm[] = [
  {
    name: 'Blue Guardian',
    eval: 'Instant + 1–3 step',
    split: 90,
    funding: 400,
    fundingLabel: '$400K',
    drawdown: 'Trailing',
    payout: 'On-demand · 24h',
    url: 'https://blueguardian.com/?afmc=JTNQ',
  },
  {
    name: 'Traders Launch',
    eval: '1-step',
    split: 80,
    funding: 300,
    fundingLabel: '$300K',
    drawdown: 'End-of-day',
    payout: 'Daily',
    url: 'https://app.traderslaunch.com/auth/purchasing-signup?ref=a3c0661ed05708abe4eceb42&coupon=JTNQ',
  },
  {
    name: 'Top One Futures',
    eval: 'Instant + 1-step',
    split: 90,
    funding: 150,
    fundingLabel: '$150K',
    drawdown: 'Trailing',
    payout: 'On-demand',
    url: 'https://toponefutures.com/?linkId=lp_707970&sourceId=jtnq&tenantId=toponefutures',
  },
  {
    name: 'FundedSeat',
    eval: 'Instant + 1-step',
    split: 90,
    funding: 150,
    fundingLabel: '$150K',
    drawdown: 'End-of-day',
    payout: 'Daily',
    url: 'https://fundedseat.link/jtnq',
  },
];

type SortKey = 'name' | 'split' | 'funding';

const META = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'FUTURES PROP FIRMS',
    title: 'Prop firms',
    phrase: 'The futures prop firms I’m partnered with, side by side. Every link applies my code JTNQ.',
  },
  note: 'Figures verified on each firm’s official site, July 2026. Split is the maximum; drawdown and pricing scale with account size, and promos change — check the live site before buying.',
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of the prop firms listed and earns a commission on sign-ups made with code JTNQ.',
  },
};

export default function PropFirms() {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'split', dir: 'desc' });

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.13 0.028 165)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  const rows = useMemo(() => {
    const arr = [...FIRMS];
    arr.sort((a, b) => {
      let d: number;
      if (sort.key === 'name') d = a.name.localeCompare(b.name);
      else d = a[sort.key] - b[sort.key];
      return sort.dir === 'asc' ? d : -d;
    });
    return arr;
  }, [sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );

  const caret = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '');

  return (
    <div className="jtnq-cmp">
      <style>{CSS}</style>

      <main>
        <section className="hero">
          <div className="back-bar">
            <a className="back" href={META.backToHome.url}>
              <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{META.backToHome.label}</span>
            </a>
          </div>

          <div className="eyebrow">{META.hero.eyebrow}</div>
          <h1 className="wordmark">
            {META.hero.title}
            <span className="dot">.</span>
          </h1>
          <p className="phrase">{META.hero.phrase}</p>
        </section>

        <section className="table-section">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-firm">
                    <button type="button" className={`h ${sort.key === 'name' ? 'active' : ''}`} onClick={() => toggle('name')}>
                      Firm <span className="caret">{caret('name')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`h ${sort.key === 'split' ? 'active' : ''}`} onClick={() => toggle('split')}>
                      Split <span className="caret">{caret('split')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`h ${sort.key === 'funding' ? 'active' : ''}`} onClick={() => toggle('funding')}>
                      Max funding <span className="caret">{caret('funding')}</span>
                    </button>
                  </th>
                  <th><span className="h static">Drawdown</span></th>
                  <th><span className="h static">Payout</span></th>
                  <th className="col-cta"><span className="h static">Code {CODE}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.name}>
                    <td className="col-firm">
                      <span className="firm-name">{f.name}</span>
                      <span className="firm-eval">{f.eval}</span>
                    </td>
                    <td className="num">{f.split}%</td>
                    <td className="num">{f.fundingLabel}</td>
                    <td>
                      <span className={`tag ${f.drawdown === 'Trailing' ? 'tag-trail' : 'tag-eod'}`}>{f.drawdown}</span>
                    </td>
                    <td className="soft">{f.payout}</td>
                    <td className="col-cta">
                      <a className="row-cta" href={f.url} target="_blank" rel="noopener nofollow sponsored">
                        Get funded
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17L17 7M9 7h8v8" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">{META.note}</p>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {META.brand}
            <span className="dot">.</span>
          </div>
          <div className="footer-meta">
            <a href={META.legal.mentionsUrl}>Legal</a>
            <span className="sep">·</span>
            <a href={META.legal.privacyUrl}>Privacy policy</a>
            <br />
            <span>{META.legal.copyright}</span>
          </div>
        </div>
        <p className="footer-disclaimer">{META.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

const CSS = `
@font-face{
  font-family:'JetBrains Mono';
  font-style:normal; font-weight:400 500; font-display:swap;
  src:url('/fonts/JetBrainsMono.woff2') format('woff2');
}
@font-face{
  font-family:'Zodiak';
  font-style:normal; font-weight:700; font-display:swap;
  src:url('/fonts/Zodiak-Bold.woff2') format('woff2');
}
.jtnq-cmp{
  --c-bg: oklch(0.13 0.028 165);
  --c-bg-raise: oklch(0.17 0.032 165);
  --c-bg-deep: oklch(0.11 0.025 165);
  --c-text: oklch(0.95 0.025 95);
  --c-text-soft: oklch(0.78 0.025 120);
  --c-text-mute: oklch(0.55 0.025 140);
  --c-text-deep: oklch(0.38 0.02 150);
  --c-accent: oklch(0.78 0.14 75);
  --c-line: oklch(0.27 0.032 165);
  --c-line-soft: oklch(0.22 0.028 165);
  --f-serif: 'Fraunces', 'Times New Roman', serif;
  --f-sans: 'Satoshi', system-ui, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
  --maxw: 1120px;
  --pad-x: clamp(24px, 5vw, 64px);
  font-family: var(--f-sans);
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.jtnq-cmp a{ color: inherit; text-decoration: none; }
.jtnq-cmp ::selection{ background: var(--c-accent); color: var(--c-bg); }

.jtnq-cmp .back-bar{
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  padding: 22px var(--pad-x); display: flex; align-items: center; justify-content: space-between; gap: 24px;
}
.jtnq-cmp .back{
  font-family: var(--f-sans); font-size: 13px; color: var(--c-text-mute);
  display: inline-flex; align-items: center; gap: 8px; transition: color .2s ease, gap .2s ease;
}
.jtnq-cmp .back .arr{ width: 14px; height: 14px; }
.jtnq-cmp .back:hover{ color: var(--c-accent); gap: 12px; }

.jtnq-cmp .hero{
  position: relative; padding: clamp(120px, 15vh, 168px) var(--pad-x) clamp(48px, 6vw, 72px);
  text-align: center; overflow: hidden; isolation: isolate;
}
.jtnq-cmp .hero::before{
  content: ""; position: absolute; inset: auto 0 -30% 0; height: 70%;
  background: radial-gradient(60% 70% at 50% 80%, color-mix(in oklab, var(--c-accent) 15%, transparent) 0%, transparent 65%);
  pointer-events: none; z-index: -1;
}
.jtnq-cmp .eyebrow{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
  color: var(--c-accent); display: inline-flex; align-items: center; gap: 12px; margin-bottom: clamp(24px, 3.5vw, 40px);
}
.jtnq-cmp .eyebrow::before, .jtnq-cmp .eyebrow::after{ content: ""; width: 28px; height: 1px; background: var(--c-accent); }
.jtnq-cmp .wordmark{
  font-family: 'Zodiak', var(--f-serif); font-weight: 700;
  font-size: clamp(52px, 9vw, 132px); line-height: .92; letter-spacing: -0.028em; margin: 0; color: var(--c-text);
}
.jtnq-cmp .wordmark .dot{ color: var(--c-accent); }
.jtnq-cmp .phrase{
  margin: clamp(24px, 3.5vw, 40px) auto 0; max-width: 46ch;
  font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(18px, 2.1vw, 25px); line-height: 1.35; letter-spacing: -0.01em; color: var(--c-text-soft); text-wrap: balance;
}

.jtnq-cmp .table-section{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(32px, 4vw, 48px) var(--pad-x) clamp(72px, 9vw, 104px);
}
.jtnq-cmp .table-wrap{
  overflow-x: auto; border: 1px solid var(--c-line); border-radius: 14px; background: var(--c-bg-raise);
  -webkit-overflow-scrolling: touch;
}
.jtnq-cmp table{ width: 100%; min-width: 680px; border-collapse: collapse; }
.jtnq-cmp thead th{
  text-align: left; padding: 0; border-bottom: 1px solid var(--c-line);
  background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%);
}
.jtnq-cmp .h{
  display: inline-flex; align-items: center; gap: 7px; width: 100%;
  padding: clamp(16px, 1.8vw, 20px) clamp(16px, 1.8vw, 22px);
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--c-text-mute);
  background: none; border: none; cursor: pointer; transition: color .2s ease;
}
.jtnq-cmp .h.static{ cursor: default; }
.jtnq-cmp button.h:hover{ color: var(--c-accent); }
.jtnq-cmp .h.active{ color: var(--c-accent); }
.jtnq-cmp .caret{ font-size: 9px; color: var(--c-accent); min-width: 8px; }

.jtnq-cmp tbody tr{ border-bottom: 1px solid var(--c-line-soft); transition: background .2s ease; }
.jtnq-cmp tbody tr:last-child{ border-bottom: none; }
.jtnq-cmp tbody tr:hover{ background: color-mix(in oklab, var(--c-bg-raise) 82%, var(--c-accent) 6%); }
.jtnq-cmp td{ padding: clamp(18px, 2vw, 24px) clamp(16px, 1.8vw, 22px); vertical-align: middle; }

.jtnq-cmp .col-firm{ position: sticky; left: 0; z-index: 1; background: var(--c-bg-raise); }
.jtnq-cmp thead .col-firm{ background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%); }
.jtnq-cmp tbody tr:hover .col-firm{ background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 6%); }
.jtnq-cmp .firm-name{
  display: block; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(19px, 1.8vw, 23px); letter-spacing: -0.01em; color: var(--c-text); line-height: 1.1;
}
.jtnq-cmp .firm-eval{
  display: block; margin-top: 6px; font-family: var(--f-mono); font-size: 10px; letter-spacing: .12em;
  text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-cmp td.num{ font-family: var(--f-mono); font-size: clamp(16px, 1.5vw, 19px); font-weight: 500; color: var(--c-text); letter-spacing: .01em; }
.jtnq-cmp td.soft{ font-family: var(--f-sans); font-size: 14px; color: var(--c-text-soft); }
.jtnq-cmp .tag{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--c-line); color: var(--c-text-soft); white-space: nowrap;
}
.jtnq-cmp .tag-trail{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .tag-eod{ color: var(--c-text-soft); }

.jtnq-cmp .col-cta{ text-align: right; white-space: nowrap; }
.jtnq-cmp .row-cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-weight: 500; font-size: 13px; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 9px 16px; border-radius: 999px;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-cmp .row-cta svg{ width: 12px; height: 12px; }
.jtnq-cmp .row-cta:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-cmp .note{
  margin: clamp(24px, 3vw, 32px) 0 0; max-width: 78ch;
  font-family: var(--f-sans); font-size: 13px; line-height: 1.6; color: var(--c-text-mute); text-wrap: pretty;
}

.jtnq-cmp .site-footer{
  background: var(--c-bg-deep); border-top: 1px solid var(--c-line-soft); padding: 56px var(--pad-x) 48px;
}
.jtnq-cmp .footer-inner{
  max-width: var(--maxw); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: start;
}
@media (max-width: 720px){ .jtnq-cmp .footer-inner{ grid-template-columns: 1fr; } }
.jtnq-cmp .footer-brand{ font-family: var(--f-serif); font-style: italic; font-size: 22px; color: var(--c-text); }
.jtnq-cmp .footer-brand .dot{ color: var(--c-accent); }
.jtnq-cmp .footer-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--c-text-mute); text-align: right; line-height: 1.9;
}
@media (max-width: 720px){ .jtnq-cmp .footer-meta{ text-align: left; } }
.jtnq-cmp .footer-meta a{ color: var(--c-text-soft); }
.jtnq-cmp .footer-meta a:hover{ color: var(--c-accent); }
.jtnq-cmp .footer-meta .sep{ color: var(--c-text-deep); margin: 0 10px; }
.jtnq-cmp .footer-disclaimer{
  max-width: var(--maxw); margin: 40px auto 0; padding-top: 28px; border-top: 1px solid var(--c-line-soft);
  font-size: 12px; line-height: 1.7; color: var(--c-text-deep); text-wrap: pretty;
}
`;
