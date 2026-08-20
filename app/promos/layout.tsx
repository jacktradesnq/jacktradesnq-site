import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live prop firm promos, code JTNQ · JackTradesNQ',
  description:
    'Every promo my partner futures prop firms are running right now, on the $50K account: price after discount, profit split, payout speed, drawdown type and the catch. Prices checked daily off their own sites. Code JTNQ.',
};

export default function PromosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
