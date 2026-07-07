import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JackTradesNQ',
  description: 'JackTradesNQ — NQ Futures trader. Free TradingView indicators and trading content.',
  metadataBase: new URL('https://jacktradesnq.com'),
  openGraph: {
    type: 'website',
    url: 'https://jacktradesnq.com/',
    title: 'JackTradesNQ — NQ Futures Trader',
    description: 'Free TradingView indicators and trading content on NQ Futures.',
    siteName: 'JackTradesNQ',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'JackTradesNQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@jacktradesnq',
    title: 'JackTradesNQ — NQ Futures Trader',
    description: 'Free TradingView indicators and trading content on NQ Futures.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#12201a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
