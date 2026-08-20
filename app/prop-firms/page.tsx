'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import rawData from '@/public/data/prop-firms.json';
import { AssetNav, CSS, META, money, sizeLabel } from './shared';

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

const FIRM_LOGOS: Record<string, string> = {
  'blue-guardian': '/logos/blue-guardian.svg',
  'traders-launch': '/logos/traders-launch.png',
  'top-one-futures': '/logos/top-one-futures.png',
  'fundedseat': '/logos/fundedseat.png',
  'legends-trading': '/logos/legends-trading.png',
  'e8-markets': '/logos/e8-markets.svg',
  'tradeday': '/logos/tradeday.png',
};

const DATA = rawData as unknown as PropData;

type Mode = 'eval' | 'instant';
type Candidate = { program: Program; plan: Plan };

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

// A firm whose scraper failed (or that has none) keeps its old prices while the
// file's generatedAt still says today — the page used to advertise that date for
// everyone, so Top One served 3-week-old prices under a "synced today" line.
// Say the truth instead: name the firms that are behind, and mark their rows.
// "2026-08-01" -> "1 Aug 2026", the same way the manual date below is written.
const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
const behindFirms = DATA.firms.filter((f) => f.lastChecked !== DATA.generatedAt);
const SYNC_NOTE =
  behindFirms.length === 0
    ? `Prices and promo codes auto-checked daily — last sync ${humanDate(DATA.generatedAt)}.`
    : `Prices and promo codes auto-checked daily — last sync ${humanDate(DATA.generatedAt)}, except ${behindFirms
        .map((f) => `${f.name}, checked ${humanDate(f.lastChecked)}`)
        .join('; ')}.`;
const NOTE = `Figures pulled from each firm's official site. ${SYNC_NOTE} Risk rules verified manually 19 Jul 2026. Promos change fast; the live checkout price wins.`;

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
          <a className="hero-promos" href="/promos/">
            See what is on promo today
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </section>

        <section className="table-section">
          <AssetNav current="futures" />

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
                {tableFirms.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>
                      No {mode === 'eval' ? 'evaluation' : 'instant funding'} plan at {sizeLabel(size)} from any
                      partner firm — switch the program type or pick another size.
                    </td>
                  </tr>
                )}
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
      {firm.lastChecked !== DATA.generatedAt && (
        <span
          className="stale-chip"
          title={`Prices last verified on ${humanDate(firm.lastChecked)}, not at the last daily sync (${humanDate(DATA.generatedAt)}). Check the live checkout price.`}
        >
          prices {humanDate(firm.lastChecked)}
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
              <span className="plan-count">{candidates.length} plan{candidates.length > 1 ? 's' : ''}</span>
              <span className="firm-row-id">
                {FIRM_LOGOS[firm.id] && (
                  <img className="firm-logo" src={FIRM_LOGOS[firm.id]} alt="" width={22} height={22} loading="lazy" />
                )}
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
