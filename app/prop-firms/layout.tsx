import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trading Partnerships — futures and perps prop firms, trade copier, code JTNQ · JackTradesNQ',
  description:
    'Every plan from JackTradesNQ’s partner prop firms, futures and perps: account sizes, prices with live promos, profit targets, max drawdown and daily loss rules. Plus Tradecopia, the trade copier he uses. Every link applies code JTNQ.',
};

export default function PropFirmsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
