import React from 'react';

export interface ReportBar {
  label: string;
  value: number; // signed, used for bar height/side
  display: string; // pre-formatted text, e.g. "+28%" or "−10%"
}
export interface ReportHBar {
  name: string;
  pct: number; // 0–100 fill width
  display: string;
  dim?: boolean;
}
export interface ReportCard {
  label: string;
  value: string;
  sub?: string;
  hot?: boolean;
}
export interface ReportChart {
  kind: 'diverging' | 'hbars';
  label?: string;
  sub?: string;
  baselineLabel?: string;
  note?: string;
  bars?: ReportBar[]; // for diverging
  rows?: ReportHBar[]; // for hbars
}
export interface ReportData {
  eyebrow: string;
  title: string;
  hero: { stat: string; caption: string };
  chart?: ReportChart;
  cards: ReportCard[];
  useIt: string;
  disclaimer: string;
  pdf?: { href: string; label: string };
}

/** Bold **text** → <strong>; plain text otherwise. No other markdown. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

function DivergingChart({ chart }: { chart: ReportChart }) {
  const bars = chart.bars ?? [];
  const cols = `repeat(${bars.length}, 1fr)`;
  const maxUp = Math.max(1, ...bars.filter((b) => b.value > 0).map((b) => b.value));
  const maxDown = Math.max(1, ...bars.filter((b) => b.value < 0).map((b) => -b.value));
  // Adapt zone heights to the data so an all-negative (or all-positive) chart
  // doesn't leave a big empty half.
  const hasUp = bars.some((b) => b.value > 0);
  const hasDown = bars.some((b) => b.value < 0);
  const topH = hasUp ? (hasDown ? 124 : 150) : 30;
  const botH = hasDown ? (hasUp ? 64 : 150) : 24;
  return (
    <div className="rep-dchart">
      <div className="rep-cols" style={{ gridTemplateColumns: cols }}>
        {bars.map((b) => {
          const up = b.value >= 0;
          const h = up ? (b.value / maxUp) * 100 : (-b.value / maxDown) * 100;
          return (
            <div className="rep-col" key={b.label}>
              <div className="rep-top" style={{ height: topH }}>
                {up && b.value !== 0 ? (
                  <>
                    <span className="rep-v up">{b.display}</span>
                    <div className="rep-bar up" style={{ height: `${h}%` }} />
                  </>
                ) : null}
              </div>
              <div className="rep-bot" style={{ height: botH }}>
                {!up ? (
                  <>
                    <div className="rep-bar down" style={{ height: `${h}%` }} />
                    <span className="rep-v down">{b.display}</span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rep-zero">{chart.baselineLabel ? <span>{chart.baselineLabel}</span> : null}</div>
      <div className="rep-daylabels" style={{ gridTemplateColumns: cols }}>
        {bars.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

function HBarsChart({ chart }: { chart: ReportChart }) {
  const rows = chart.rows ?? [];
  return (
    <div className="rep-hbars">
      {rows.map((r) => (
        <div className="rep-hrow" key={r.name}>
          <span className="rep-hname">{r.name}</span>
          <div className="rep-htrack">
            <div className={'rep-hfill' + (r.dim ? ' dim' : '')} style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
          </div>
          <span className="rep-hpct">{r.display}</span>
        </div>
      ))}
    </div>
  );
}

export default function StudyReport({ report, compact = false }: { report: ReportData; compact?: boolean }) {
  const { eyebrow, title, hero, chart, cards, useIt, disclaimer, pdf } = report;

  // Compact mode: report-card HEAD only (eyebrow + title + hero stat + how-to-use
  // + disclaimer). Used atop studies that keep their full interactive body
  // (IFVG dashboards, straddle explorers) below — so the page opens like a
  // report-card without dropping the explorable backtest data.
  if (compact) {
    return (
      <div className="rep rep-compact">
        <div className="rep-eyebrow">{eyebrow}</div>
        <h1 className="rep-title">
          {title}
          <span className="dot">.</span>
        </h1>
        <div className="rep-hero">
          <div className="rep-hero-big">{hero.stat}</div>
          <div className="rep-hero-cap">{renderInline(hero.caption)}</div>
        </div>
        <div className="rep-use">
          <div className="rep-use-h">How to use it</div>
          <p>{renderInline(useIt)}</p>
        </div>
        <div className="rep-disc">{disclaimer}</div>
      </div>
    );
  }

  return (
    <div className="rep">
      <div className="rep-eyebrow">{eyebrow}</div>
      <h1 className="rep-title">
        {title}
        <span className="dot">.</span>
      </h1>

      <div className="rep-hero">
        <div className="rep-hero-big">{hero.stat}</div>
        <div className="rep-hero-cap">{renderInline(hero.caption)}</div>
      </div>

      {chart ? (
        <>
          {chart.label ? <p className="rep-sec-lbl">{chart.label}</p> : null}
          {chart.sub ? <p className="rep-sec-sub">{chart.sub}</p> : null}
          {chart.kind === 'diverging' ? <DivergingChart chart={chart} /> : <HBarsChart chart={chart} />}
          {chart.note ? <p className="rep-note">{chart.note}</p> : null}
        </>
      ) : null}

      <div className="rep-cards">
        {cards.map((c) => (
          <div className={'rep-card' + (c.hot ? ' hot' : '')} key={c.label}>
            <div className="rep-card-lbl">{c.label}</div>
            <div className="rep-card-val">{c.value}</div>
            {c.sub ? <div className="rep-card-sub">{c.sub}</div> : null}
          </div>
        ))}
      </div>

      <div className="rep-use">
        <div className="rep-use-h">How to use it</div>
        <p>{renderInline(useIt)}</p>
      </div>

      {pdf ? (
        <a className="rep-pdf" href={pdf.href} download>
          ↓ {pdf.label}
        </a>
      ) : null}

      <div className="rep-disc">{disclaimer}</div>
    </div>
  );
}
