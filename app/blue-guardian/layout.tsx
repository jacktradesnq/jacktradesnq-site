import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blue Guardian — futures prop firm, code JTNQ · JackTradesNQ',
  description:
    'Blue Guardian Futures: 90% split, instant-funding & 1-to-3-step accounts from $5K to $400K, on-demand payouts, no activation fee. Sign up with code JTNQ.',
};

export default function BlueGuardianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
