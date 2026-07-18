import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prop firms — futures partners compared, code JTNQ · JackTradesNQ',
  description:
    'Compare every plan from JackTradesNQ’s partner futures prop firms: account sizes, prices with live promos, profit targets, max drawdown and daily loss rules. Every link applies code JTNQ.',
};

export default function PropFirmsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
