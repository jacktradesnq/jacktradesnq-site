import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crypto prop firms — funded crypto programs compared · JackTradesNQ',
  description:
    'Compare every crypto program from JackTradesNQ’s partner prop firms: account sizes, prices, profit targets, daily loss and drawdown as a percentage of your balance, leverage per coin. Every link is tracked.',
};

export default function PropFirmsCryptoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
