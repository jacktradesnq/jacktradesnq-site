import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prop firms — futures, perps and CFD partners, code JTNQ · JackTradesNQ',
  description:
    'Every plan from JackTradesNQ’s partner prop firms, futures, perps and CFD: account sizes, prices with live promos, profit targets, max drawdown and daily loss rules. Every link applies code JTNQ.',
};

export default function PropFirmsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
