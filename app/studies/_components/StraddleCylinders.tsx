'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { TradeRow } from '@/lib/strategy-stats';

interface Segment {
  pct: number;
  count: number;
  name: string;
  color: string;
  text: string;
  hrefParam?: { key: string; value: string };
}

function Cylinder({ label, total, segments }: { label: string; total: number; segments: Segment[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (param: { key: string; value: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'trades');
    params.set(param.key, param.value);
    router.push(pathname + '?' + params.toString());
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: 'var(--f-sans)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--c-ink)' }}>
        {label}
        <span style={{ marginLeft: 8, color: 'var(--c-ink-quiet)', fontWeight: 400 }}>{total} trades</span>
      </div>
      <div
        role="group"
        aria-label={`${label}: ${segments.map((s) => `${s.name} ${s.pct.toFixed(1)}%`).join(', ')}`}
        style={{
          width: '100%',
          maxWidth: 180,
          height: 320,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--c-paper-edge)',
          boxShadow: '0 1px 2px oklch(0.20 0.02 70 / 0.06)',
        }}
      >
        {segments.map((s) => {
          const clickable = !!s.hrefParam && s.count > 0;
          return (
            <button
              key={s.name}
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => navigate(s.hrefParam!) : undefined}
              title={clickable ? `Show ${s.count} ${s.name.toLowerCase()} trades` : undefined}
              aria-label={`${s.name} ${s.pct.toFixed(1)}%, ${s.count} trades`}
              style={{
                flexBasis: `${s.pct}%`,
                background: s.color,
                color: s.text,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--f-sans)',
                fontSize: s.pct < 8 ? '0.7rem' : '0.95rem',
                fontWeight: 700,
                padding: s.pct < 8 ? '2px 4px' : '6px 8px',
                minHeight: 0,
                border: 'none',
                cursor: clickable ? 'pointer' : 'default',
                width: '100%',
                transition: 'filter 120ms ease',
              }}
              onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
            >
              <span>{s.pct.toFixed(1)}%</span>
              {s.pct >= 6 && (
                <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
                  {s.name} · {s.count}
                </span>
              )}
              {s.pct < 6 && s.pct > 0 && (
                <span style={{ fontSize: '0.6rem', fontWeight: 500, opacity: 0.85, marginLeft: 6 }}>
                  {s.name} · {s.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function StraddleCylinders({ trades }: { trades: TradeRow[] }) {
  const total = trades.length;
  if (total === 0) return null;

  const longs = trades.filter((t) => t.side === 'long').length;
  const shorts = trades.filter((t) => t.side === 'short').length;
  const wins = trades.filter((t) => t.pnl_pts > 0).length;
  const losses = trades.filter((t) => t.pnl_pts < 0).length;
  const flats = total - wins - losses;

  const sideSegments: Segment[] = [
    { name: 'Long', count: longs, pct: (longs / total) * 100, color: 'var(--c-accent)', text: 'var(--c-ink)', hrefParam: { key: 'smt', value: 'long' } },
    { name: 'Short', count: shorts, pct: (shorts / total) * 100, color: 'var(--c-yellow-soft)', text: 'var(--c-ink)', hrefParam: { key: 'smt', value: 'short' } },
  ];

  const outcomeSegments: Segment[] = [
    { name: 'Win', count: wins, pct: (wins / total) * 100, color: 'var(--c-sage)', text: 'var(--c-paper)', hrefParam: { key: 'outcome', value: 'win' } },
    { name: 'Loss', count: losses, pct: (losses / total) * 100, color: 'var(--c-terra)', text: 'var(--c-paper)', hrefParam: { key: 'outcome', value: 'loss' } },
    ...(flats > 0
      ? [{ name: 'Flat', count: flats, pct: (flats / total) * 100, color: 'var(--c-accent)', text: 'var(--c-ink)', hrefParam: { key: 'outcome', value: 'flat' } } as Segment]
      : []),
  ];

  return (
    <div style={{ marginTop: 32 }}>
      <div className="v3-wd-h">Distribution</div>
      <div className="v3-wd-sub">Direction taken and outcome across all filtered trades.</div>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', justifyContent: 'center', paddingTop: 16 }}>
        <Cylinder label="Side" total={total} segments={sideSegments} />
        <Cylinder label="Outcome" total={total} segments={outcomeSegments} />
      </div>
    </div>
  );
}
