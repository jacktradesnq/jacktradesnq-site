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
  codeDiscountPct?: number;
  url: string;
  lastChecked: string;
  stale: boolean;
  programs: Program[];
};
type PropData = { generatedAt: string; firms: Firm[] };

const DATA = rawData as unknown as PropData;

type Mode = 'eval' | 'instant';
type Candidate = { program: Program; plan: Plan };

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', Number.isInteger(n) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sizeLabel = (n: number) => '$' + n / 1000 + 'K';

const DD_LABEL: Record<DdType, string> = {
  EOD: 'No trail',
  'EOD Trailing': 'EOD Trail',
  Intraday: 'Intraday Trail',
};
const DD_TITLE: Record<DdType, string> = {
  EOD: 'Static drawdown — fixed loss limit from your starting balance',
  'EOD Trailing': 'Trailing drawdown — the limit follows your end-of-day balance highs',
  Intraday: 'Trailing drawdown — the limit follows your equity in real time',
};

// Same promo fallback logic used everywhere on this page: a program-level
// promo wins, otherwise fall back to the firm-level promo.
function promoFor(firm: Firm, program: Program): { code: string | null; title: string } {
  const code = program.promoCode ?? firm.promo?.code ?? null;
  const label = program.promoLabel ?? firm.promo?.label ?? null;
  const ends = program.promoCode ? undefined : firm.promo?.ends;
  const title = [label, ends ? `ends ${ends}` : null].filter(Boolean).join(' — ');
  return { code, title };
}

// Every program of the firm's current mode that has a plan at `size`. Shared
// by the summary row (which picks the cheapest) and its expand panel (which
// lists all of them).
function candidatesAt(programs: Program[], size: number): Candidate[] {
  return programs
    .map((program) => ({ program, plan: program.plans.find((pl) => pl.size === size) }))
    .filter((c): c is Candidate => c.plan != null);
}

// Which code to show on a firm's chip: an explicit firm-level code wins
// (e.g. E8's temporary tracking id), firms without the field use Angelo's
// global code, and code:null falls back to the firm's public promo code.
const chipCode = (firm: Firm, promoCode: string | null) =>
  firm.code === undefined ? CODE : firm.code ?? promoCode;

// Price actually paid through Angelo's link/code. His permanent code discount
// (e.g. Traders Launch -15%) only applies when the firm shows no public promo
// of its own (originalPrice == null) — public promos already discount `price`.
function effectivePrice(firm: Firm, plan: Plan): { now: number; was: number | null; viaCode: boolean } {
  if (firm.codeDiscountPct != null && plan.originalPrice == null) {
    return { now: plan.price * (1 - firm.codeDiscountPct / 100), was: plan.price, viaCode: true };
  }
  return { now: plan.price, was: plan.originalPrice, viaCode: false };
}

function ddTag(plan: Plan) {
  return (
    <span className={`tag ${plan.ddType === 'EOD' ? 'tag-eod' : 'tag-trail'}`} title={DD_TITLE[plan.ddType]}>
      {DD_LABEL[plan.ddType]}
    </span>
  );
}

function dailyLossValue(plan: Plan) {
  if (plan.dailyLoss != null) {
    return (
      <>
        {money(plan.dailyLoss)}
        {plan.dailyLossSoft && (
          <span className="soft-flag" title="Soft breach: position flattened, account not lost">
            soft
          </span>
        )}
      </>
    );
  }
  return <span className="none">None</span>;
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

const NOTE = `Figures pulled from each firm's official site. Prices and promo codes auto-checked daily — last sync ${DATA.generatedAt}. Risk rules verified manually 19 Jul 2026. Promos change fast; the live checkout price wins.`;

export default function PropFirms() {
  const [size, setSize] = useState(100000);
  const [mode, setMode] = useState<Mode>('eval');
  const [expandedFirmId, setExpandedFirmId] = useState<string | null>(null);

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

  // Firms with at least one plan at the selected mode + size — drives the table rows.
  const tableFirms = useMemo(
    () =>
      DATA.firms.filter(
        (firm) => candidatesAt(firm.programs.filter((p) => p.type === mode), size).length > 0,
      ),
    [mode, size],
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

        <section className="table-section">
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

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-firm"><span className="h">Firm</span></th>
                  <th><span className="h">Price today</span></th>
                  <th><span className="h">Max profit</span></th>
                  <th><span className="h">Max loss limit</span></th>
                  <th><span className="h">Daily loss</span></th>
                  <th className="col-cta" aria-label="Sign-up link" />
                </tr>
              </thead>
              <tbody>
                {tableFirms.map((firm) => (
                  <FirmRow
                    key={firm.id}
                    firm={firm}
                    mode={mode}
                    size={size}
                    expanded={expandedFirmId === firm.id}
                    onToggle={() => setExpandedFirmId((cur) => (cur === firm.id ? null : firm.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend">
            <p>No trail — fixed loss limit, never moves</p>
            <p>EOD Trail — limit follows your end-of-day balance</p>
            <p>Intraday Trail — limit follows your equity in real time</p>
            <p>soft — position flattened, account survives · "from $X" — cheapest plan at this size</p>
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

// One firm: a compact summary row (cheapest plan at the current mode/size)
// plus an expand panel listing every program's plan at that size. No local
// size/mode state — both come from the page. `expanded` + `onToggle` are
// lifted to the page too, so only one panel is ever open at a time.
function FirmRow({
  firm,
  mode,
  size,
  expanded,
  onToggle,
}: {
  firm: Firm;
  mode: Mode;
  size: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const programs = firm.programs.filter((p) => p.type === mode);
  const candidates = candidatesAt(programs, size);
  const cheapestOfMany = candidates.length > 1;
  const winner =
    candidates.length > 0 ? candidates.reduce((best, c) => (c.plan.price < best.plan.price ? c : best)) : null;
  const expandId = `expand-${firm.id}`;

  if (!winner) return null;
  const promo = promoFor(firm, winner.program);
  const rowPrice = effectivePrice(firm, winner.plan);

  const firmMeta = (
    <span className="firm-row-meta">
      {firm.split} split · {firm.payout}
      {chipCode(firm, promo.code) && (
        <span className="promo-chip" title={promo.title || undefined}>
          code {chipCode(firm, promo.code)}
        </span>
      )}
    </span>
  );

  return (
    <>
      <tr className="firm-row">
        <td className="col-firm">
          <button
              type="button"
              className="row-expand-btn"
              aria-expanded={expanded}
              aria-controls={expandId}
              onClick={onToggle}
            >
              <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span className="plan-count">{candidates.length} plans</span>
              <span className="firm-row-id">
                <span className="firm-row-name">{firm.name}</span>
                {firmMeta}
              </span>
          </button>
        </td>

        <td className="num cell-price" data-label="Price today">
              <span className="price-line">
                {cheapestOfMany && <span className="price-from">from </span>}
                {money(rowPrice.now)}
                {winner.program.priceType === 'monthly' && <span className="per">/mo</span>}
                {rowPrice.was != null && <s className="price-was">{money(rowPrice.was)}</s>}
              </span>
              {rowPrice.viaCode && (
                <span className="activation-note">code {chipCode(firm, promo.code)} −{firm.codeDiscountPct}%</span>
              )}
              {winner.plan.activationFee != null && (
                <span className="activation-note">+ {money(winner.plan.activationFee)} activation</span>
              )}
            </td>
        <td className="num cell-target" data-label="Max profit">
          {winner.plan.profitTarget != null ? money(winner.plan.profitTarget) : <span className="none">None</span>}
        </td>
        <td className="num cell-loss" data-label="Max loss limit">
          {money(winner.plan.maxDrawdown)} {ddTag(winner.plan)}
        </td>
        <td className="num cell-daily" data-label="Daily loss">{dailyLossValue(winner.plan)}</td>

        <td className="col-cta">
          <a className="row-cta" href={firm.url} target="_blank" rel="noopener nofollow sponsored">
            Get funded
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </td>
      </tr>

      {winner && (
        <tr className="expand-row">
          <td colSpan={6} className="expand-cell">
            <div className={`expand-wrap${expanded ? ' is-open' : ''}`}>
              <div id={expandId} className="expand-panel" aria-hidden={!expanded}>
                {candidates.map(({ program, plan }) => {
                  const subPromo = promoFor(firm, program);
                  return (
                    <div key={program.name} className="sub-row">
                      <span className="sub-name">
                        {program.name} · {program.type}
                      </span>
                      <span className="sub-price">
                        {money(effectivePrice(firm, plan).now)}
                        {program.priceType === 'monthly' && <span className="per">/mo</span>}
                        {effectivePrice(firm, plan).was != null && (
                          <s className="price-was">{money(effectivePrice(firm, plan).was as number)}</s>
                        )}
                        {subPromo.code && (
                          <span className="promo-chip" title={subPromo.title || undefined}>
                            code {chipCode(firm, subPromo.code)}
                          </span>
                        )}
                      </span>
                      <span className="sub-target">
                        {plan.profitTarget != null ? `${money(plan.profitTarget)} target` : <span className="none">no target</span>}
                      </span>
                      <span className="sub-loss">
                        {money(plan.maxDrawdown)} {ddTag(plan)}
                      </span>
                      <span className="sub-daily">{dailyLossValue(plan)}</span>
                      <span className="sub-consistency">{plan.consistency} consistency</span>
                      <span className="sub-contracts">{plan.contracts}</span>
                      {plan.activationFee != null && (
                        <span className="sub-activation">+ {money(plan.activationFee)} activation</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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

@media (prefers-reduced-motion: reduce){
  .jtnq-cmp *{ transition: none !important; }
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
  display: inline-flex; align-items: center; width: 100%;
  padding: clamp(16px, 1.8vw, 20px) clamp(10px, 1.2vw, 14px);
  font-family: var(--f-mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--c-text-mute);
  white-space: nowrap;
}

.jtnq-cmp tbody tr{ border-bottom: 1px solid var(--c-line-soft); transition: background .2s ease; }
.jtnq-cmp tbody tr:last-child{ border-bottom: none; }
.jtnq-cmp tbody tr:hover{ background: color-mix(in oklab, var(--c-bg-raise) 82%, var(--c-accent) 6%); }
.jtnq-cmp td{ padding: 16px clamp(10px, 1.2vw, 14px); vertical-align: middle; }

.jtnq-cmp .col-firm{ position: sticky; left: 0; z-index: 1; background: var(--c-bg-raise); }
.jtnq-cmp thead .col-firm{ background: color-mix(in oklab, var(--c-bg-raise) 70%, var(--c-bg-deep) 30%); }
.jtnq-cmp tbody tr:hover .col-firm{ background: color-mix(in oklab, var(--c-bg-raise) 88%, var(--c-accent) 6%); }

.jtnq-cmp .row-expand-btn{
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer;
}
.jtnq-cmp .chevron{
  width: 14px; height: 14px; flex-shrink: 0; color: var(--c-accent); transition: transform .2s ease, color .2s ease;
}
.jtnq-cmp .row-expand-btn:hover .chevron{ color: var(--c-accent); }
.jtnq-cmp .row-expand-btn[aria-expanded="true"] .chevron{ transform: rotate(90deg); color: var(--c-accent); }
.jtnq-cmp .plan-count{
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); white-space: nowrap;
}

.jtnq-cmp .firm-row-id{ display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.jtnq-cmp .firm-row-name{
  display: block; font-family: var(--f-serif); font-style: italic; font-weight: 400;
  font-size: clamp(19px, 1.8vw, 23px); letter-spacing: -0.01em; color: var(--c-text); line-height: 1.1;
}
.jtnq-cmp .firm-row-meta{
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--c-text-mute);
}

.jtnq-cmp td.num{ font-family: var(--f-mono); font-size: clamp(15px, 1.4vw, 18px); font-weight: 500; color: var(--c-text); letter-spacing: .01em; white-space: nowrap; }
.jtnq-cmp .cell-price{ white-space: normal; }
.jtnq-cmp .price-line{ display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.jtnq-cmp .price-was{ font-size: 12px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .price-from{ font-size: 11px; font-weight: 400; color: var(--c-text-mute); }
.jtnq-cmp .per{ font-size: 11px; color: var(--c-text-mute); }
.jtnq-cmp .activation-note{
  display: block; margin-top: 4px; font-family: var(--f-sans); font-size: 11px; font-style: italic;
  font-weight: 400; color: var(--c-text-mute); white-space: nowrap;
}
.jtnq-cmp .cell-loss .tag{ margin-left: 4px; }

.jtnq-cmp .promo-chip{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; font-weight: 400;
  letter-spacing: .1em; text-transform: uppercase; color: var(--c-accent);
  border: 1px solid color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); border-radius: 999px;
  padding: 3px 9px; white-space: nowrap; cursor: help;
}
.jtnq-cmp .soft-flag{
  margin-left: 8px; font-size: 10px; font-weight: 400; letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-text-mute); cursor: help;
}
.jtnq-cmp .none{ color: var(--c-text-mute); font-weight: 400; font-size: 13px; }
.jtnq-cmp .tag{
  display: inline-block; font-family: var(--f-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--c-line); color: var(--c-text-soft); white-space: nowrap;
  font-weight: 400;
}
.jtnq-cmp .tag-trail{ color: var(--c-accent); border-color: color-mix(in oklab, var(--c-accent) 45%, var(--c-line)); }
.jtnq-cmp .tag-eod{ color: var(--c-text-soft); }


.jtnq-cmp .col-cta{ text-align: right; white-space: nowrap; }
.jtnq-cmp .row-cta{
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-sans); font-weight: 500; font-size: 13px; color: var(--c-accent);
  border: 1px solid var(--c-accent); padding: 8px 13px; border-radius: 999px; white-space: nowrap;
  transition: background .2s ease, color .2s ease, transform .2s ease;
}
.jtnq-cmp .row-cta svg{ width: 12px; height: 12px; }
.jtnq-cmp .row-cta:hover{ background: var(--c-accent); color: var(--c-bg); transform: translateY(-1px); }

.jtnq-cmp .expand-cell{ padding: 0; }
.jtnq-cmp .expand-wrap{
  display: grid; grid-template-rows: 0fr; transition: grid-template-rows .2s ease;
}
.jtnq-cmp .expand-wrap.is-open{ grid-template-rows: 1fr; }
.jtnq-cmp .expand-panel{
  overflow: hidden; min-height: 0; display: flex; flex-direction: column;
  padding: 0 clamp(16px, 1.8vw, 22px);
  background: color-mix(in oklab, var(--c-bg-raise) 80%, var(--c-bg-deep) 20%);
  transition: padding .2s ease;
}
.jtnq-cmp .expand-wrap.is-open .expand-panel{ padding: 12px clamp(16px, 1.8vw, 22px); }
.jtnq-cmp tbody tr.expand-row{ border-bottom: none; }
.jtnq-cmp .sub-row{
  display: flex; flex-wrap: wrap; align-items: baseline;
  font-family: var(--f-mono); font-size: 12px; color: var(--c-text-soft);
  padding: 8px 0; border-bottom: 1px solid var(--c-line-soft);
}
.jtnq-cmp .sub-row:last-child{ border-bottom: none; }
.jtnq-cmp .sub-price{ display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.jtnq-cmp .sub-row > *{ margin-right: 10px; }
.jtnq-cmp .sub-row > *:not(:first-child)::before{ content: '· '; color: var(--c-text-deep); }
.jtnq-cmp .sub-name{ color: var(--c-text); font-weight: 500; }
.jtnq-cmp .sub-activation{ color: var(--c-text-mute); font-style: italic; }

.jtnq-cmp .legend{
  display: flex; flex-direction: column; gap: 6px; margin: 16px 0 0;
}
.jtnq-cmp .legend p{
  margin: 0; font-family: var(--f-mono); font-size: 11px; line-height: 1.5; color: var(--c-text-mute);
}

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

@media (max-width: 720px){
  .jtnq-cmp .hero{ padding: 72px var(--pad-x) 32px; }
  .jtnq-cmp .wordmark{ font-size: clamp(40px, 13vw, 60px); }
  .jtnq-cmp .phrase{ font-size: 14px; margin-top: 20px; }

  .jtnq-cmp .table-wrap{ border: none; background: none; border-radius: 0; overflow: visible; }
  .jtnq-cmp table, .jtnq-cmp tbody, .jtnq-cmp tr, .jtnq-cmp td{ display: block; width: 100%; }
  .jtnq-cmp table{ min-width: 0; }
  .jtnq-cmp thead{ display: none; }

  .jtnq-cmp tr.firm-row{
    display: grid; grid-template-columns: 1fr 1fr;
    grid-template-areas: "firm firm" "target loss" "price daily" "cta cta";
    column-gap: 16px; row-gap: 16px;
    background: var(--c-bg-raise); border: 1px solid var(--c-line); border-radius: 14px;
    padding: 18px; margin-bottom: 12px;
  }
  .jtnq-cmp tr.firm-row td{ padding: 0; }

  .jtnq-cmp td.col-firm{ grid-area: firm; position: static; background: none; }
  .jtnq-cmp td.cell-target{ grid-area: target; }
  .jtnq-cmp td.cell-loss{ grid-area: loss; }
  .jtnq-cmp td.cell-price{ grid-area: price; }
  .jtnq-cmp td.cell-daily{ grid-area: daily; }
  .jtnq-cmp td.col-cta{ grid-area: cta; text-align: center; }

  .jtnq-cmp tr.firm-row td.num{ white-space: normal; }
  .jtnq-cmp td.cell-target, .jtnq-cmp td.cell-loss{ font-size: 20px; }
  .jtnq-cmp td.cell-price, .jtnq-cmp td.cell-daily{ font-size: 15px; }

  .jtnq-cmp td[data-label]::before{
    content: attr(data-label); display: block; margin-bottom: 4px;
    font-family: var(--f-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--c-text-mute);
  }

  .jtnq-cmp .row-cta{ width: 100%; justify-content: center; padding: 14px 20px; }

  .jtnq-cmp tr.expand-row{ margin-bottom: 0; }
  .jtnq-cmp tr.expand-row:has(.is-open){ margin-bottom: 12px; }
  .jtnq-cmp .expand-cell{ padding: 0; }
  .jtnq-cmp .expand-wrap.is-open .expand-panel{
    border: 1px solid var(--c-line); border-radius: 14px; padding: 16px;
  }
}
`;
