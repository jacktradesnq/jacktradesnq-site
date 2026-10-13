import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trade copier — Tradecopia, code JTNQ · JackTradesNQ',
  description:
    'Tradecopia is the trade copier JackTradesNQ uses to copy his trades across his accounts. Real daily P&L cards, wins and losses. Code JTNQ.',
};

export default function TradeCopierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
