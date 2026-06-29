import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FundedSeat — futures prop firm, code JTNQ · JackTradesNQ',
  description: 'FundedSeat: up to a 90% split, daily payouts from day one, end-of-day drawdown, 1-step & instant funding up to $150K. Get funded with code JTNQ.',
};

export default function FundedSeatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
