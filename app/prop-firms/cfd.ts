// CFD firms (public/data/cfd-firms.json, read by hand, not auto-synced) turned into
// FirmView. CFD firms publish their limits as a percentage of the balance, so the cells
// are the strings of the JSON.

import rawCfdData from '@/public/data/cfd-firms.json';
import { goHref } from '@/lib/go-links';
import { cheapest, humanDate, splitCommon, type Cell, type FirmView, type PriceCell } from './firm-view';

type CfdPlan = { size: number; price: number };
type CfdProgram = {
  name: string;
  market: 'cfd';
  steps: string;
  profitTarget: string | null;
  dailyLoss: string | null;
  maxDrawdown: string | null;
  ddType: string | null;
  minDays: string | null;
  split: string;
  leverage: string;
  note: string;
  plans: CfdPlan[];
};
// Firm-wide discount applied by the affiliate link itself (checked on the firm's checkout).
type CfdDiscount = { code: string; discountPct: number; appliedByLink: boolean; endsAt: string | null; lastChecked: string };
type CfdFirm = {
  id: string;
  name: string;
  logo: string | null;
  payout: string;
  promo: { label: string; code: string } | null;
  discount?: CfdDiscount;
  url: string;
  lastChecked: string;
  stale: boolean;
  programs: CfdProgram[];
};

const DATA = rawCfdData as unknown as { generatedAt: string; firms: CfdFirm[] };

// Same arithmetic as the firm's checkout: list price x (100 - pct) / 100, to the cent.
const discounted = (price: number, pct: number) => Math.round(price * (100 - pct)) / 100;

const DD_TITLE: Record<string, string> = {
  Static: 'The loss limit never moves',
  Trailing: 'The loss limit follows your closed balance up to your starting balance, then stops',
};

// A firm can publish "None" for a limit (no daily loss on Tradeify FX Daily): that is a
// rule, not a missing figure, so it reads "None"; null means not published, "n/c".
const limit = (v: string | null): Cell =>
  v == null ? { text: 'n/c', muted: true } : v === 'None' ? { text: 'None', muted: true } : { text: v };

const SUMMARY: Record<string, string> = {
  'tradeify-fx': '80% split · payouts daily to on demand',
};

const NOTE = `List prices and rules read on each firm's own site and help center on ${humanDate(DATA.generatedAt)}, not auto-synced. Discounted prices are the list price minus the firm's discount, checked on its checkout on ${humanDate(DATA.firms.find((f) => f.discount)?.discount?.lastChecked ?? DATA.generatedAt)}. Promos change fast; the live checkout price wins.`;

function firmView(firm: CfdFirm): FirmView {
  const programs = firm.programs;
  const d = firm.discount;

  const { common, rules } = splitCommon([
    { label: 'Program', cells: programs.map((p) => ({ text: p.steps })), common: (c) => c.text },
    { label: 'Profit target', cells: programs.map((p) => limit(p.profitTarget)), common: (c) => `${c.text} profit target` },
    {
      label: 'Max drawdown',
      cells: programs.map((p): Cell =>
        p.maxDrawdown
          ? {
              text: p.maxDrawdown,
              tag: p.ddType ? { label: p.ddType, title: DD_TITLE[p.ddType] ?? p.ddType, accent: p.ddType !== 'Static' } : undefined,
            }
          : { text: 'n/c', muted: true },
      ),
      common: (c) => `${c.text} ${c.tag ? `${c.tag.label.toLowerCase()} ` : ''}max drawdown`,
    },
    { label: 'Daily loss limit', cells: programs.map((p) => limit(p.dailyLoss)), common: (c) => `${c.text} daily loss limit` },
    { label: 'Profit split', cells: programs.map((p) => ({ text: p.split })), common: (c) => `${c.text} profit split` },
    { label: 'Leverage', cells: programs.map((p) => ({ text: p.leverage })), common: (c) => `${c.text} leverage` },
    {
      label: 'Minimum days',
      cells: programs.map((p) => (p.minDays ? { text: p.minDays } : { text: 'None', muted: true })),
      common: (c) => (c.muted ? 'No minimum trading days' : `Minimum ${c.text}`),
      skip: programs.every((p) => !p.minDays),
    },
    { label: 'Notes', cells: programs.map((p) => ({ text: p.note, note: true })), common: (c) => c.text },
  ]);

  const sizes = [...new Set(programs.flatMap((p) => p.plans.map((pl) => pl.size)))].sort((a, b) => a - b);
  const sizeRows = sizes.map((size) => ({
    size,
    cells: programs.map((p): PriceCell => {
      const plan = p.plans.find((pl) => pl.size === size);
      if (!plan) return null;
      return {
        kind: 'price',
        now: d ? discounted(plan.price, d.discountPct) : plan.price,
        was: d ? plan.price : null,
        per: null,
        from: false,
        lines: [],
      };
    }),
  }));

  const hasTrail = programs.some((p) => p.ddType);
  return {
    id: firm.id,
    name: firm.name,
    logo: firm.logo,
    summary: SUMMARY[firm.id] ?? '',
    code: firm.promo ? { code: firm.promo.code, title: firm.promo.label } : null,
    stale: null,
    from: cheapest(sizeRows),
    columns: programs.map((p) => ({ name: p.name })),
    common,
    rules,
    priceTitle: d ? `Price with code ${d.code}` : 'Price',
    priceSub: d ? `${d.discountPct}% off${d.appliedByLink ? ', applied by the link' : ''}` : null,
    sizes: sizeRows,
    legend: [
      'Every limit is a percentage of your starting balance, the way CFD firms publish them',
      ...(hasTrail ? ['Static — the loss limit never moves · Trailing — it follows your closed balance up to your starting balance, then stops'] : []),
      ...(rules.some((r) => r.cells.some((c) => c.text === 'n/c')) ? ['n/c — the firm does not publish that limit per program'] : []),
    ],
    note: NOTE,
    href: goHref('prop-firms', firm.id),
  };
}

export const CFD_FIRMS: FirmView[] = DATA.firms.map(firmView);
