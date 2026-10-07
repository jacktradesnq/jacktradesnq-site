'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { WeekdayBreakdown, WeekdayStats } from '@/lib/strategy-stats';
import { LOOKBACK_LABELS } from '@/lib/lookback-labels';
import WeekdayBars from './WeekdayBars';

// V3Tabs « By weekday » tab.
export function WeekdayBlock({
  breakdown,
  slug,
  smtLabel = 'SMT-on',
  totalTradesCount = 0,
}: {
  breakdown: WeekdayBreakdown;
  slug: string;
  smtLabel?: string;
  totalTradesCount?: number;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const lookback = sp.get('lookback') || 'all';

  const days: Array<{ key: keyof WeekdayBreakdown; label: string }> = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
  ];

  const validDays = days.filter((d) => breakdown[d.key].n > 0);
  const bestDay = validDays.length
    ? validDays.reduce((a, b) => (breakdown[a.key].wr >= breakdown[b.key].wr ? a : b))
    : null;
  const losingDays = validDays.filter((d) => breakdown[d.key].net < 0);
  const worstDay = losingDays.length
    ? losingDays.reduce((a, b) => (breakdown[a.key].net <= breakdown[b.key].net ? a : b))
    : null;

  const maxWr = Math.max(...days.map((d) => breakdown[d.key].wr), 1);

  function barClass(st: WeekdayStats) {
    if (st.n === 0) return 'v3-wd-bar';
    if (st.net > 5) return 'v3-wd-bar pos';
    if (st.net < -5) return 'v3-wd-bar neg';
    return 'v3-wd-bar gold';
  }

  function pnlClass(st: WeekdayStats) {
    if (st.net > 0) return 'v3-wd-stat-pnl pos';
    if (st.net < 0) return 'v3-wd-stat-pnl neg';
    return 'v3-wd-stat-pnl zero';
  }

  const verdict = (() => {
    if (!bestDay) return 'Not enough data across weekdays to draw conclusions.';
    const bestSt = breakdown[bestDay.key];
    const parts: string[] = [
      `Best day: ${bestDay.label} (${bestSt.wr}% WR · ${bestSt.net >= 0 ? '+' : ''}${bestSt.net} pts net, N=${bestSt.n}).`,
    ];
    if (worstDay && worstDay.key !== bestDay.key) {
      const wSt = breakdown[worstDay.key];
      parts.push(`Worst: ${worstDay.label} (${wSt.wr}% WR · ${wSt.net} pts net).`);
    }
    return parts.join(' ');
  })();

  const hasData = validDays.length > 0;

  if (!hasData && totalTradesCount > 0) {
    const isLookbackLimit = lookback !== 'all';
    return (
      <div className="v3-coming-soon">
        {isLookbackLimit
          ? `No weekday data in the last ${LOOKBACK_LABELS[lookback] ?? lookback}.`
          : 'No weekday data for this filter combo.'}
        <br />
        <button type="button" className="v3-empty-cta" onClick={() => {
          const params = new URLSearchParams(sp.toString());
          if (isLookbackLimit) {
            params.set('lookback', 'all');
          } else {
            params.delete('variant'); params.delete('tp'); params.delete('smt'); params.delete('outcome');
          }
          router.replace(`/studies/${slug}/?${params.toString()}`, { scroll: false });
        }}>
          {isLookbackLimit ? `View all-time data (${totalTradesCount} trades)` : 'Reset filters'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <WeekdayBars breakdown={breakdown} title="Net PnL by weekday" subtitle={smtLabel} />
      <div className="v3-wd-h">Performance by day of the week</div>
      <div className="v3-wd-sub">Real data — {smtLabel} variant · tp1_be.</div>
      <div className="v3-wd-grid">
        {days.map((d) => {
          const st = breakdown[d.key];
          const isBest = bestDay?.key === d.key;
          const isWorst = worstDay?.key === d.key;
          const colClass = 'v3-wd-col' + (isBest ? ' best' : isWorst ? ' worst' : '');
          const barH = st.n === 0 ? 4 : Math.max(6, Math.round((st.wr / maxWr) * 80));
          return (
            <Link
              key={d.key}
              href={`/studies/${slug}/?tab=trades&day=${d.key}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className={colClass}>
                <div className="v3-wd-col-day">{d.label}</div>
                <div className="v3-wd-bar-wrap">
                  <div className={barClass(st)} style={{ height: `${barH}%` }} />
                </div>
                {st.n === 0 ? (
                  <>
                    <div className="v3-wd-stat">—</div>
                    <div className="v3-wd-stat-sub">N=0</div>
                    <div className="v3-wd-stat-pnl zero">no events</div>
                  </>
                ) : (
                  <>
                    <div className="v3-wd-stat">{st.wr}%</div>
                    <div className="v3-wd-stat-sub">N={st.n} · WR</div>
                    <div className={pnlClass(st)}>
                      {st.net >= 0 ? '+' : ''}{st.net} pts
                    </div>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="v3-wd-verdict">
        {bestDay ? (
          <>
            Best day: <strong>{bestDay.label}</strong>
            {' '}({breakdown[bestDay.key].wr}% WR · {breakdown[bestDay.key].net >= 0 ? '+' : ''}{breakdown[bestDay.key].net} pts net, N={breakdown[bestDay.key].n}).
            {worstDay && worstDay.key !== bestDay.key && ` Worst: ${worstDay.label} (${breakdown[worstDay.key].wr}% WR · ${breakdown[worstDay.key].net} pts net).`}
          </>
        ) : verdict}
      </div>
    </div>
  );
}
