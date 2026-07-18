'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import rawData from '@/public/data/prop-firms.json';

// Affiliate code applied on every firm link below.
const CODE = 'JTNQ';

// Every figure on this page comes from public/data/prop-firms.json
// (scraped from each firm's official site — see scripts/scrape-prop-firms.mjs).
type DdType = 'EOD' | 'EOD Trailing' | 'Intraday';
type Plan = {
  size: number;
  price: number;
  originalPrice: number | null;
  profitTarget: number | null;
  maxDrawdown: number;
  ddType: DdType;
  dailyLoss: number | null;
  dailyLossSoft: boolean;
  consistency: string;
  contracts: string;
  activationFee?: number;
};
type Program = {
  name: string;
  type: 'eval' | 'instant';
  priceType: 'one-time' | 'monthly';
  promoCode?: string;
  promoLabel?: string;
  plans: Plan[];
};
type Firm = {
  id: string;
  name: string;
  split: string;
  payout: string;
  promo: { label: string; code: string; ends?: string } | null;
  code?: string | null;
  url: string;
  lastChecked: string;
  stale: boolean;
  programs: Program[];
};
type PropData = { generatedAt: string; firms: Firm[] };

const DATA = rawData as unknown as PropData;

type Mode = 'eval' | 'instant';
type SortKey = 'firm' | 'price' | 'target' | 'drawdown';
type Row = { firm: Firm; program: Program; plan: Plan };

const money = (n: number) => '$' + n.toLocaleString('en-US');
const sizeLabel = (n: number) => '$' + n / 1000 + 'K';

const DD_LABEL: Record<DdType, string> = {
  EOD: 'EOD',
  'EOD Trailing': 'EOD Trail',
  Intraday: 'Intraday',
};

// Same promo fallback logic used by the table rows and the firm cards:
// a program-level promo wins, otherwise fall back to the firm-level promo.
function promoFor(firm: Firm, program: Program): { code: string | null; title: string } {
  const code = program.promoCode ?? firm.promo?.code ?? null;
  const label = program.promoLabel ?? firm.promo?.label ?? null;
  const ends = program.promoCode ? undefined : firm.promo?.ends;
  const title = [label, ends ? `ends ${ends}` : null].filter(Boolean).join(' — ');
  return { code, title };
}

const META = {
  backToHome: { label: 'Jacktradesnq', url: '/' },
  brand: 'Jacktradesnq',
  hero: {
    eyebrow: 'FUTURES PROP FIRMS',
    title: 'Prop firms',
    phrase:
      'Every plan from the firms I’m partnered with — account sizes, prices and risk rules, side by side. My code JTNQ or tracked link applied on every button.',
  },
  legal: {
    copyright: '© 2026 JackTradesNQ. All rights reserved.',
    mentionsUrl: '/mentions-legales/',
    privacyUrl: '/politique-confidentialite/',
    disclaimer:
      'Disclaimer — In accordance with article D.321-1 of the French Monétaire et Financier Code, the content published on this site is provided for informational purposes only and does not constitute investment advice. This page is an advertisement: JackTradesNQ is an affiliate of the prop firms listed and earns a commission on sign-ups made with code JTNQ.',
  },
};

const NOTE = `Figures pulled from each firm's official site. Prices and promo codes auto-checked daily — last sync ${DATA.generatedAt}. Risk rules verified manually 18 Jul 2026. Promos change fast; the live checkout price wins.`;

export default function PropFirms() {
  const [size, setSize] = useState(100000);
  const [mode, setMode] = useState<Mode>('eval');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'price', dir: 'asc' });

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = 'oklch(0.13 0.028 165)';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  const sizes = useMemo(() => {
    const all = new Set<number>();
    for (const firm of DATA.firms)
      for (const program of firm.programs) for (const plan of program.plans) all.add(plan.size);
    return [...all].sort((a, b) => a - b);
  }, []);

  // Firms with at least one program in the current mode — drives the cards grid.
  const cardFirms = useMemo(
    () => DATA.firms.filter((firm) => firm.programs.some((p) => p.type === mode)),
    [mode],
  );

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const firm of DATA.firms) {
      for (const program of firm.programs) {
        if (program.type !== mode) continue;
        const plan = program.plans.find((p) => p.size === size);
        if (plan) out.push({ firm, program, plan });
      }
    }
    out.sort((a, b) => {
      let d: number;
      if (sort.key === 'firm')
        d =
          a.firm.name.localeCompare(b.firm.name) ||
          a.program.name.localeCompare(b.program.name);
      else if (sort.key === 'price') d = a.plan.price - b.plan.price;
      else if (sort.key === 'target')
        d = (a.plan.profitTarget ?? Infinity) - (b.plan.profitTarget ?? Infinity);
      else d = a.plan.maxDrawdown - b.plan.maxDrawdown;
      return sort.dir === 'asc' ? d : -d;
    });
    return out;
  }, [size, mode, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'drawdown' ? 'desc' : 'asc' },
    );

  const caret = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '');

  const sortableHeader = (key: SortKey, label: string) => (
    <button type="button" className={`h ${sort.key === key ? 'active' : ''}`} onClick={() => toggle(key)}>
      {label} <span className="caret">{caret(key)}</span>
    </button>
  );

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

        <section className="cards-section">
          <div className="mode-toggle-row">
            <div className="mode-toggle" role="group" aria-label="Program type">
              <button
                type="button"
                className={`mode ${mode === 'eval' ? 'active' : ''}`}
                aria-pressed={mode === 'eval'}
                onClick={() => setMode('eval')}
              >
                Evaluation
              </button>
              <button
                type="button"
                className={`mode ${mode === 'instant' ? 'active' : ''}`}
                aria-pressed={mode === 'instant'}
                onClick={() => setMode('instant')}
              >
                Instant funding
              </button>
            </div>
          </div>

          <div className="cards-grid">
            {cardFirms.map((firm) => (
              <FirmCard key={`${firm.id}-${mode}`} firm={firm} mode={mode} />
            ))}
          </div>
        </section>

        <section className="table-section">
          <div className="table-eyebrow">
            <span className="eyebrow-sm">COMPARE EVERY PLAN</span>
            <p className="table-subtitle">Every plan, every size, side by side.</p>
          </div>

          <div className="controls">
            <div className="size-pills" role="group" aria-label="Account size">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pill ${s === size ? 'active' : ''}`}
                  aria-pressed={s === size}
                  onClick={() => setSize(s)}
                >
                  {sizeLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-firm">{sortableHeader('firm', 'Firm')}</th>
                  <th>{sortableHeader('price', 'Price')}</th>
                  <th>{sortableHeader('target', 'Profit target')}</th>
                  <th>{sortableHeader('drawdown', 'Max drawdown')}</th>
                  <th><span className="h static">Daily loss</span></th>
                  <th><span className="h static">Split</span></th>
                  <th className="col-cta"><span className="h static">Code {CODE}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>
                      No {mode === 'instant' ? 'instant-funding' : 'evaluation'} plans at this size — try another size.
                    </td>
                  </tr>
                )}
                {rows.map(({ firm, program, plan }) => {
                  const promo = promoFor(firm, program);
                  return (
                    <tr key={`${firm.id}-${program.name}`}>
                      <td className="col-firm">
                        <span className="firm-name">{firm.name}</span>
                        <span className="firm-eval">
                          {program.name} · {program.type === 'eval' ? 'Eval' : 'Instant'}
                        </span>
                      </td>
                      <td className="num price-cell">
                        <span className="price-line">
                          <span className="price-now">
                            {money(plan.price)}
                            {program.priceType === 'monthly' && <span className="per">/mo</span>}
                          </span>
                          {plan.originalPrice != null && (
                            <s className="price-was">{money(plan.originalPrice)}</s>
                          )}
                        </span>
                        {promo.code && (
                          <span className="promo-chip" title={promo.title || undefined}>
                            code {promo.code}
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {plan.profitTarget != null ? money(plan.profitTarget) : <span className="none">—</span>}
                      </td>
                      <td className="num dd-cell">
                        {money(plan.maxDrawdown)}{' '}
                        <span className={`tag ${plan.ddType === 'EOD' ? 'tag-eod' : 'tag-trail'}`}>
                          {DD_LABEL[plan.ddType]}
                        </span>
                      </td>
                      <td className="num">
                        {plan.dailyLoss != null ? (
                          <>
                            {money(plan.dailyLoss)}
                            {plan.dailyLossSoft && (
                              <span
                                className="soft-flag"
                                title="Soft breach: position flattened, account not lost"
                              >
                                soft
                              </span>
                            )}
                          </>
                        ) : firm.id === 'traders-launch' && !plan.dailyLossSoft ? (
                          <span className="none">None advertised</span>
                        ) : (
                          <span className="none">None</span>
                        )}
                      </td>
                      <td className="num">{firm.split}</td>
                      <td className="col-cta">
                        <a className="row-cta" href={firm.url} target="_blank" rel="noopener nofollow sponsored">
                          Get funded
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17L17 7M9 7h8v8" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">{NOTE}</p>
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

// One label/value row inside a firm card's stats block. `hero` renders the
// two headline stats (max profit target, max loss limit) bigger.
function StatRow({
  label,
  value,
  sub,
  hero,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  hero?: boolean;
}) {
  return (
    <div className={`stat-row${hero ? ' stat-hero' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {sub && <span className="stat-sub">{sub}</span>}
      </span>
    </div>
  );
}

// A single firm card: program tabs (if >1 for this mode) + account size pills
// + the real numbers for whichever plan is selected. Remounted (via key) on
// every mode change so its local program/size selection always resets.
function FirmCard({ firm, mode }: { firm: Firm; mode: Mode }) {
  const programs = firm.programs.filter((p) => p.type === mode);
  const [programIdx, setProgramIdx] = useState(0);
  const program = programs[programIdx] ?? programs[0];
  const sizes = program.plans.map((p) => p.size);
  const [planSize, setPlanSize] = useState<number>(() => (sizes.includes(100000) ? 100000 : sizes[0]));

  const selectProgram = (idx: number) => {
    setProgramIdx(idx);
    const nextSizes = programs[idx].plans.map((p) => p.size);
    setPlanSize((cur) => (nextSizes.includes(cur) ? cur : nextSizes.includes(100000) ? 100000 : nextSizes[0]));
  };

  const plan = program.plans.find((p) => p.size === planSize) ?? program.plans[0];
  const promo = promoFor(firm, program);

  return (
    <article className="firm-card">
      <header className="card-head">
        <h2 className="card-firm-name">{firm.name}</h2>
        <span className="card-meta">
          {firm.split} split · {firm.payout} payout
        </span>
      </header>

      {promo.code && (
        <span className="promo-chip card-promo" title={promo.title || undefined}>
          code {promo.code}
        </span>
      )}

      {programs.length > 1 && (
        <div className="card-tabs" role="group" aria-label={`${firm.name} program type`}>
          {programs.map((p, idx) => (
            <button
              key={p.name}
              type="button"
              className={`card-tab ${idx === programIdx ? 'active' : ''}`}
              aria-pressed={idx === programIdx}
              onClick={() => selectProgram(idx)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="card-sizes" role="group" aria-label={`${firm.name} account size`}>
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            className={`pill ${s === planSize ? 'active' : ''}`}
            aria-pressed={s === planSize}
            onClick={() => setPlanSize(s)}
          >
            {sizeLabel(s)}
          </button>
        ))}
      </div>

      <div className="card-stats">
        <div className="card-stats-hero">
          <StatRow
            hero
            label="Max profit target"
            value={plan.profitTarget != null ? money(plan.profitTarget) : <span className="none">None</span>}
            sub={plan.profitTarget == null ? 'instant funded — no target' : undefined}
          />
          <StatRow
            hero
            label="Max loss limit"
            value={
              <>
                {money(plan.maxDrawdown)}{' '}
                <span className={`tag ${plan.ddType === 'EOD' ? 'tag-eod' : 'tag-trail'}`}>
                  {DD_LABEL[plan.ddType]}
                </span>
              </>
            }
          />
        </div>

        <div className="card-stats-secondary">
          <StatRow
            label="Price today"
            value={
              <>
                {money(plan.price)}
                {program.priceType === 'monthly' && <span className="per">/mo</span>}
                {plan.originalPrice != null && <s className="price-was">{money(plan.originalPrice)}</s>}
              </>
            }
          />
          {plan.activationFee != null && (
            <StatRow
              label="Activation fee"
              value={money(plan.activationFee)}
              sub="one-time at funding"
            />
          )}
          <StatRow
            label="Daily loss"
            value={
              plan.dailyLoss != null ? (
                <>
                  {money(plan.dailyLoss)}
                  {plan.dailyLossSoft && (
                    <span className="soft-flag" title="Soft breach: position flattened, account not lost">
                      soft
                    </span>
                  )}
                </>
              ) : firm.id === 'traders-launch' && !plan.dailyLossSoft ? (
                <span className="none">None advertised</span>
              ) : (
                <span className="none">None</span>
              )
            }
          />
          <StatRow label="Contracts" value={plan.contracts} />
          <StatRow label="Consistency" value={plan.consistency} />
        </div>
      </div>

      <a className="card-cta" href={firm.url} target="_blank" rel="noopener nofollow sponsored">
        {firm.code === null ? 'Get funded' : `Get funded — code ${CODE}`}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      </a>

      <p className="card-footnote">
        Rules shown: {sizeLabel(planSize)} {program.name} · checked {firm.lastChecked}
      </p>
    </article>
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

.jtnq-cmp .controls{
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 24px;
}
.jtnq-cmp .size-pills{ display: flex; flex-wrap: wrap; gap: 8px; }
.jtnq-cmp .pill{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-soft); background: none; border: 1px solid var(--c-line); border-radius: 999px;
  padding: 8px 16px; cursor: pointer; transition: color .2s ease, border-color .2s ease, background .2s ease;
}
.jtnq-cmp .pill:hover{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .pill.active{ color: var(--c-bg); background: var(--c-accent); border-color: var(--c-accent); }
.jtnq-cmp .mode-toggle{
  display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--c-line); border-radius: 999px;
  background: var(--c-bg-raise);
}
.jtnq-cmp .mode{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-mute); background: none; border: none; border-radius: 999px;
  padding: 8px 16px; cursor: pointer; transition: color .2s ease, background .2s ease;
}
.jtnq-cmp .mode:hover{ color: var(--c-accent); }
.jtnq-cmp .mode.active{ color: var(--c-bg); background: var(--c-accent); }

.jtnq-cmp .table-wrap{
  overflow-x: auto; border: 1px solid var(--c-line); border-radius: 14px; background: var(--c-bg-raise);
  -webkit-overflow-scrolling: touch;
}
.jtnq-cmp table{ width: 100%; min-width: 880px; border-collapse: collapse; }
.jtnq-cmp thead th{
  text-align: left; padding: 0; border-bottom: 1px solid var(--c-line);
  background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%);
}
.jtnq-cmp .h{
  display: inline-flex; align-items: center; gap: 7px; width: 100%;
  padding: clamp(16px, 1.8vw, 20px) clamp(16px, 1.8vw, 22px);
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--c-text-mute);
  background: none; border: none; cursor: pointer; transition: color .2s ease; white-space: nowrap;
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
  text-transform: uppercase; color: var(--c-text-mute); white-space: nowrap;
}
.jtnq-cmp td.num{ font-family: var(--f-mono); font-size: clamp(15px, 1.4vw, 18px); font-weight: 500; color: var(--c-text); letter-spacing: .01em; white-space: nowrap; }
.jtnq-cmp td.soft{ font-family: var(--f-sans); font-size: 14px; color: var(--c-text-soft); }

.jtnq-cmp .price-cell .price-line{ display: flex; align-items: baseline; gap: 8px; }
.jtnq-cmp .price-now{ font-size: clamp(16px, 1.5vw, 19px); }
.jtnq-cmp .price-now .per{ font-size: 11px; color: var(--c-text-mute); }
.jtnq-cmp .price-was{ font-size: 12px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .promo-chip{
  display: inline-block; margin-top: 4px; font-family: var(--f-mono); font-size: 10px; font-weight: 400;
  letter-spacing: .1em; text-transform: uppercase; color: var(--c-accent);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); border-radius: 999px;
  padding: 3px 9px; white-space: nowrap; cursor: help;
}
.jtnq-cmp .soft-flag{
  margin-left: 8px; font-size: 10px; font-weight: 400; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); cursor: help;
}
.jtnq-cmp .none{ color: var(--c-text-mute); font-weight: 400; font-size: 13px; }
.jtnq-cmp .dd-cell .tag{ margin-left: 4px; }
.jtnq-cmp .tag{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--c-line); color: var(--c-text-soft); white-space: nowrap;
  font-weight: 400;
}
.jtnq-cmp .tag-trail{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .tag-eod{ color: var(--c-text-soft); }

.jtnq-cmp .empty-row td{
  font-family: var(--f-sans); font-size: 14px; color: var(--c-text-mute); text-align: center;
  padding: clamp(32px, 4vw, 48px) clamp(16px, 1.8vw, 22px);
}

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

/* ===== firm cards (v3) ===== */
@media (prefers-reduced-motion: reduce){
  .jtnq-cmp *{ transition: none !important; }
}

.jtnq-cmp .cards-section{
  max-width: var(--maxw); margin: 0 auto; padding: clamp(32px, 4vw, 48px) var(--pad-x) 0;
}
.jtnq-cmp .mode-toggle-row{ display: flex; justify-content: center; margin-bottom: 32px; }

.jtnq-cmp .cards-grid{
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: clamp(48px, 6vw, 64px);
}
@media (max-width: 720px){ .jtnq-cmp .cards-grid{ grid-template-columns: 1fr; } }

.jtnq-cmp .firm-card{
  display: flex; flex-direction: column; gap: 24px; min-width: 0;
  background: var(--c-bg-raise); border: 1px solid var(--c-line); border-radius: 14px;
  padding: clamp(24px, 3vw, 32px); transition: border-color .2s ease;
}
.jtnq-cmp .firm-card:hover{ border-color: color-mix(in oklab, var(--c-accent) 35%, var(--c-line)); }

.jtnq-cmp .card-head{ display: flex; flex-direction: column; gap: 8px; }
.jtnq-cmp .card-firm-name{
  font-family: var(--f-serif); font-style: italic; font-weight: 400; margin: 0;
  font-size: clamp(24px, 2.4vw, 28px); letter-spacing: -0.01em; color: var(--c-text); line-height: 1.1;
}
.jtnq-cmp .card-meta{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--c-text-mute);
}
.jtnq-cmp .card-promo{ align-self: flex-start; margin-top: 0; }

.jtnq-cmp .card-tabs{ display: flex; flex-wrap: wrap; gap: 8px; }
.jtnq-cmp .card-tab{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); background: none; border: 1px solid var(--c-line); border-radius: 999px;
  padding: 8px 14px; cursor: pointer; transition: color .2s ease, background .2s ease, border-color .2s ease;
}
.jtnq-cmp .card-tab:hover{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .card-tab.active{ color: var(--c-bg); background: var(--c-accent); border-color: var(--c-accent); }

.jtnq-cmp .card-sizes{ display: flex; flex-wrap: wrap; gap: 8px; }

.jtnq-cmp .card-stats{ display: flex; flex-direction: column; gap: 8px; }
.jtnq-cmp .card-stats-hero{
  display: flex; flex-direction: column;
  background: color-mix(in oklab, var(--c-bg) 88%, var(--c-accent) 5%);
  border: 1px solid var(--c-line-soft); border-radius: 12px; padding: 4px 16px;
}
.jtnq-cmp .card-stats-secondary{ display: flex; flex-direction: column; }

.jtnq-cmp .stat-row{
  display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  padding: 12px 0; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-cmp .stat-row:last-child{ border-bottom: none; }
.jtnq-cmp .stat-label{
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--c-text-mute); white-space: nowrap;
}
.jtnq-cmp .stat-value{
  font-family: var(--f-mono); font-size: clamp(15px, 1.5vw, 16px); font-weight: 500; color: var(--c-text); text-align: right;
}
.jtnq-cmp .stat-hero .stat-value{ font-size: clamp(21px, 2.2vw, 24px); }
.jtnq-cmp .stat-sub{
  display: block; margin-top: 4px; font-family: var(--f-sans); font-size: 11px; font-style: italic;
  font-weight: 400; color: var(--c-text-mute); white-space: nowrap;
}

.jtnq-cmp .card-cta{
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: auto;
  font-family: var(--f-sans); font-weight: 500; font-size: 14px; color: var(--c-accent);
  border: 1px solid var(--c-accent); border-radius: 999px; padding: 16px 24px;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-cmp .card-cta svg{ width: 14px; height: 14px; }
.jtnq-cmp .card-cta:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-cmp .card-footnote{
  margin: 0; font-family: var(--f-mono); font-size: 10px; letter-spacing: .08em; color: var(--c-text-deep);
}

.jtnq-cmp .table-eyebrow{ margin-bottom: 24px; }
.jtnq-cmp .eyebrow-sm{
  display: block; margin-bottom: 8px; font-family: var(--f-mono); font-size: 11px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--c-accent);
}
.jtnq-cmp .table-subtitle{
  margin: 0; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(16px, 1.6vw, 19px); color: var(--c-text-soft);
}
`;
