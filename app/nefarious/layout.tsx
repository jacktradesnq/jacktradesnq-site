import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nefarious — Free Trading Community · JackTradesNQ',
  description: 'Nefarious: free live trading room, daily signals, options & futures. Official partner of JackTradesNQ.',
};

export default function NefariousLayout({ children }: { children: React.ReactNode }) {
  return children;
}
