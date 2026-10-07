'use client';

/**
 * SimpleStatBand — the compact 4-stat card shown in Simple mode.
 *
 * Contract A.3: exact stat labels + one-line plain meanings.
 * Numbers come from the same computeKPI() the existing KPI band uses.
 */

import { LOOKBACK_LABELS } from '@/lib/lookback-labels';

interface SimpleStatBandProps {
  wr: number;       // 0–100 integer
  pf: number;       // e.g. 1.34
  n: number;        // sample size
  net: number;      // net points
  dateFrom?: string;
  dateTo?: string;
  lookback?: string;
  // First paragraph of overview prose (HTML string)
  introHtml: string;
  // When a richer hero already exposes these numbers, suppress the 4-stat band.
  hideStatBand?: boolean;
}


export default function SimpleStatBand({
  wr,
  pf,
  n,
  net,
  dateFrom,
  dateTo,
  lookback = 'all',
  introHtml,
  hideStatBand = false,
}: SimpleStatBandProps) {
  const periodLabel = lookback === 'all'
    ? (dateFrom && dateTo ? `${dateFrom}–${dateTo}` : 'full period')
    : `last ${LOOKBACK_LABELS[lookback] ?? lookback}`;

  return (
    <div className="v3-simple-wrap">
      {/* Short intro — first paragraph only */}
      <div
        className="v3-simple-intro"
        dangerouslySetInnerHTML={{ __html: introHtml }}
      />

      {/* 4-stat compact band */}
      {!hideStatBand && (
      <div className="v3-simple-band">
        <div className="v3-simple-stat">
          <div className="v3-simple-stat-val gold">{wr}%</div>
          <div className="v3-simple-stat-lbl">Win rate</div>
          <div className="v3-simple-stat-mean">% of trades that made money</div>
        </div>
        <div className="v3-simple-stat">
          <div className={`v3-simple-stat-val${pf >= 1.5 ? ' pos' : ''}`}>{pf.toFixed(2)}</div>
          <div className="v3-simple-stat-lbl">Profit factor</div>
          <div className="v3-simple-stat-mean">$ won for every $1 lost</div>
        </div>
        <div className="v3-simple-stat">
          <div className="v3-simple-stat-val">{n}</div>
          <div className="v3-simple-stat-lbl">Trades</div>
          <div className="v3-simple-stat-mean">sample size over the period</div>
        </div>
        <div className="v3-simple-stat">
          <div className={`v3-simple-stat-val${net > 0 ? ' pos' : net < 0 ? ' neg' : ''}`}>
            {net >= 0 ? '+' : ''}{net.toFixed(1)}
          </div>
          <div className="v3-simple-stat-lbl">Net result</div>
          <div className="v3-simple-stat-mean">total over the test window</div>
        </div>
      </div>
      )}

      {/* Legend */}
      <p className="v3-simple-legend">
        Stats shown for {periodLabel}. Profit factor &gt; 1 means the strategy made money overall.
      </p>
    </div>
  );
}
