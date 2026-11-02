import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'oklch(0.15 0.028 165)',
        color: 'oklch(0.95 0.025 95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        fontFamily: "'Satoshi', system-ui, sans-serif",
      }}
    >
      <p
        style={{
          fontSize: '14px',
          color: 'oklch(0.78 0.025 120)',
          margin: '0 0 20px',
        }}
      >
        404 — off the chart
      </p>
      <h1
        style={{
          fontFamily: "'Zodiak', 'Fraunces', Georgia, serif",
          fontWeight: 700,
          fontSize: 'clamp(36px, 7vw, 72px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        This setup doesn&apos;t exist<span style={{ color: 'oklch(0.80 0.135 82)' }}>.</span>
      </h1>
      <p
        style={{
          fontSize: '15px',
          color: 'oklch(0.74 0.03 140)',
          maxWidth: '46ch',
          lineHeight: 1.6,
          margin: '18px 0 32px',
        }}
      >
        The page you were looking for isn&apos;t here. It may have moved, or never printed.
      </p>
      <Link
        href="/"
        style={{
          fontSize: '14px',
          color: 'oklch(0.80 0.135 82)',
          border: '1px solid oklch(0.80 0.135 82)',
          borderRadius: '999px',
          padding: '10px 22px',
          textDecoration: 'none',
        }}
      >
        Back home ↗
      </Link>
    </main>
  );
}
