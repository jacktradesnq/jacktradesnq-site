'use client';

import { useMemo } from 'react';
import type { WeekdayBreakdown } from '@/lib/study-stats';

/* ── Full SVG mode (used by V3Tabs, props: breakdown) ── */
type Props = {
  breakdown: WeekdayBreakdown;
  title?: string;
  subtitle?: string;
};

const DAYS: Array<{ key: keyof WeekdayBreakdown; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
];

export default function WeekdayBars({
  breakdown,
  title = 'Net PnL by weekday',
  subtitle,
}: Props) {
  const { zeroFrac } = useMemo(() => {
    const nets = DAYS.map((d) => breakdown[d.key].net);
    const maxAbs = Math.max(...nets.map(Math.abs), 1);
    void maxAbs;
    const dataMin = Math.min(0, ...nets);
    const dataMax = Math.max(0, ...nets);
    const span = dataMax - dataMin || 1;
    const pad = span * 0.15;
    const yMin = dataMin - pad;
    const yMax = dataMax + pad;
    const yRange = yMax - yMin;
    const zFrac = (yMax - 0) / yRange;
    return { zeroFrac: Math.max(0, Math.min(1, zFrac)) };
  }, [breakdown]);

  const W = 500;
  const H = 160;
  const PAD_LEFT = 8;
  const PAD_RIGHT = 8;
  const PAD_TOP = 20;
  const PAD_BOT = 24;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOT;
  const BAR_W = Math.min(48, (innerW / 5) * 0.55);
  const SLOT_W = innerW / 5;
  const zeroY = PAD_TOP + zeroFrac * innerH;

  const nets = DAYS.map((d) => breakdown[d.key].net);
  const dataMin = Math.min(0, ...nets);
  const dataMax = Math.max(0, ...nets);
  const span = dataMax - dataMin || 1;
  const pad = span * 0.15;
  const yMin = dataMin - pad;
  const yMax = dataMax + pad;
  const yRange = yMax - yMin;

  function mapY(v: number): number {
    return PAD_TOP + (1 - (v - yMin) / yRange) * innerH;
  }

  const hasData = DAYS.some((d) => breakdown[d.key].n > 0);

  if (!hasData) {
    return (
      <div className="wdb-card">
        <div className="wdb-header">
          <p className="wdb-title">{title}</p>
          {subtitle && <p className="wdb-subtitle">{subtitle}</p>}
        </div>
        <div className="wdb-empty">No weekday data available.</div>
      </div>
    );
  }

  return (
    <div className="wdb-card">
      <div className="wdb-header">
        <p className="wdb-title">{title}</p>
        {subtitle && <p className="wdb-subtitle">{subtitle}</p>}
      </div>
      <div className="wdb-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label={title} role="img">
          <line
            x1={PAD_LEFT} y1={zeroY}
            x2={W - PAD_RIGHT} y2={zeroY}
            className="wdb-zero-line"
          />
          {DAYS.map((d, i) => {
            const st = breakdown[d.key];
            const cx = PAD_LEFT + SLOT_W * i + SLOT_W / 2;
            const x = cx - BAR_W / 2;
            if (st.n === 0) {
              return (
                <g key={d.key}>
                  <text x={cx} y={H - 4} className="wdb-day-label">{d.label}</text>
                </g>
              );
            }
            const barTop = mapY(Math.max(0, st.net));
            const barBot = mapY(Math.min(0, st.net));
            const barH = Math.max(2, barBot - barTop);
            const isPos = st.net > 0;
            const isNeg = st.net < 0;
            const valLabel = st.net === 0 ? '0' : st.net > 0 ? `+${st.net}` : `${st.net}`;
            const valLabelClass = isPos ? 'wdb-val-pos' : isNeg ? 'wdb-val-neg' : 'wdb-val-zero';
            const valY = isPos ? barTop - 5 : barBot + 13;
            return (
              <g key={d.key}>
                <rect x={x} y={barTop} width={BAR_W} height={barH} rx={3}
                  className={isPos ? 'wdb-bar-pos' : 'wdb-bar-neg'} />
                <text x={cx} y={valY} className={`wdb-val-label ${valLabelClass}`}>
                  {valLabel}
                </text>
                <text x={cx} y={H - 4} className="wdb-day-label">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
