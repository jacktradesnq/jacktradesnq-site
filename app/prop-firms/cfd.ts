// CFD firms (public/data/cfd-firms.json, read by hand, not auto-synced) turned into
// FirmView. CFD firms publish their limits as a percentage of the balance, so the cells
// are the strings of the JSON.

import rawCfdData from '@/public/data/cfd-firms.json';
import { goHref } from '@/lib/go-links';
import { cheapest, limitCell, splitCommon, type Cell, type FirmView, type Funded, type PriceCell } from './firm-view';

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


// tradeifyfx.co home page, read 12/10/2026: « No activation costs ».
const SUMMARY: Record<string, string> = {
  'tradeify-fx': '80% split · No activation fee',
};

// Evaluation consistency and funded rules, read on the checkout's Evaluation / Funded faces,
// the help center guides and the Funded Trader Agreement on 12/10/2026. Daily: « Daily payouts
// come from profit above a 4% buffer, which stays in your account. Maximum 3% of the account
// size per payout. », +1% new profit between payouts from the 2nd, 40% consistency in the
// evaluation only. Classic: « no minimum trading-day or profitable-day requirement before the
// first payout », every 14 days. Direct: 20% consistency to request a payout, no cap, the max
// loss locks at the starting balance « the moment you request your first payout ».
const EVAL_CONSISTENCY: Record<string, string> = { Daily: '40%', Classic: 'None', Direct: '20% to request a payout' };
const FUNDED: Record<string, Record<string, Funded>> = {
  'tradeify-fx': {
    Daily: {
      pills: [
        { label: 'Consistency', value: 'None' },
        { label: 'Payout request', value: 'Daily' },
        { label: 'Buffer', value: '4%, stays in the account' },
        { label: 'Max per payout', value: '3% of the account' },
        { label: 'Between payouts', value: '+1% new profit, from the 2nd' },
        { label: 'Minimum payout', value: '$100' },
      ],
      rows: [],
    },
    Classic: {
      pills: [
        { label: 'Winning days', value: 'None' },
        { label: 'Consistency', value: 'None' },
        { label: 'Payout request', value: 'Every 14 days' },
        { label: 'Minimum payout', value: '$100' },
      ],
      rows: [],
    },
    Direct: {
      pills: [
        { label: 'Consistency', value: '20% to request a payout' },
        { label: 'Payout cap', value: 'None' },
        { label: 'Minimum payout', value: '$100' },
        { label: 'Max loss', value: 'Locks at start balance on the 1st payout request' },
      ],
      rows: [],
    },
  },
};


function firmView(firm: CfdFirm): FirmView {
  const programs = firm.programs;
  const d = firm.discount;

  const { common, rules } = splitCommon([
    { label: 'Program', cells: programs.map((p) => ({ text: p.steps })), common: (c) => c.text },
    // No target is a rule (instant funding), as the old block showed it: "None", not "n/c".
    {
      label: 'Profit target',
      cells: programs.map((p) => limitCell(p.profitTarget ?? 'None')),
      common: (c) => (c.muted ? 'No profit target' : `${c.text} profit target`),
    },
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
    { label: 'Daily loss limit', cells: programs.map((p) => limitCell(p.dailyLoss)), common: (c) => `${c.text} daily loss limit` },
    { label: 'Profit split', cells: programs.map((p) => ({ text: p.split })), common: (c) => `${c.text} profit split` },
    { label: 'Leverage', cells: programs.map((p) => ({ text: p.leverage })), common: (c) => `${c.text} leverage` },
    {
      label: 'Minimum days',
      cells: programs.map((p) => (p.minDays ? { text: p.minDays } : { text: 'None', muted: true })),
      common: (c) => (c.muted ? 'No minimum trading days' : `Minimum ${c.text}`),
      skip: programs.every((p) => !p.minDays),
    },
    {
      label: 'Consistency',
      cells: programs.map((p) => ({ text: EVAL_CONSISTENCY[p.name] ?? 'n/c', muted: !EVAL_CONSISTENCY[p.name] })),
      common: (c) => `Consistency ${c.text}`,
    },
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
    funded: FUNDED[firm.id] ? programs.map((p) => FUNDED[firm.id][p.name] ?? null) : undefined,
    legend: [
      'Every limit is a percentage of your starting balance, the way CFD firms publish them',
      ...(hasTrail ? ['Static — the loss limit never moves · Trailing — it follows your closed balance up to your starting balance, then stops'] : []),
      ...(rules.some((r) => r.cells.some((c) => c.text === 'n/c')) ? ['n/c — the firm does not publish that limit per program'] : []),
    ],
    href: goHref('prop-firms', firm.id),
  };
}

export const CFD_FIRMS: FirmView[] = DATA.firms.map(firmView);
