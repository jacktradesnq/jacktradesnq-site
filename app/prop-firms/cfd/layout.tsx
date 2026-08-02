import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CFD prop firms — forex and indices programs compared · JackTradesNQ',
  description:
    'Compare every forex and indices program from JackTradesNQ’s partner prop firms: account sizes, prices, profit targets, daily loss and drawdown as a percentage of your balance. Every link is tracked.',
};

export default function PropFirmsCfdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
