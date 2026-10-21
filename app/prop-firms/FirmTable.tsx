'use client';

// The table of one firm, opened in a window on /prop-firms. One program at a time: its
// rules as pills (the same on every size, so said once), then a short table with one
// column per account size holding only what changes with the size — price, target, max
// loss, contracts. An Eval / Funded switch shows the funded rules instead. Angelo,
// 12/10/2026, after Lucid's plan page: « on répète les mêmes règles pour le même type de
// plan mais ce qui change c'est le prix […] faut rester dans le côté tableau ».

import { useEffect, useState } from 'react';
import { money, sizeLabel } from './shared';
import type { Cell, FirmView, Pill, PriceCell } from './firm-view';

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

const Check = () => (
  <svg className="ft-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Yes">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export function FirmLogo({ firm, size }: { firm: Pick<FirmView, 'logo' | 'name'>; size: number }) {
  if (firm.logo) return <img className="firm-mark" src={firm.logo} alt="" width={size} height={size} loading="lazy" />;
  // No logo file for the firm: its initial, same footprint, so every card lines up.
  return (
    <span className="firm-mark firm-mark--letter" style={{ width: size, height: size }} aria-hidden="true">
      {firm.name.charAt(0)}
    </span>
  );
}

function CellView({ cell }: { cell: Cell }) {
  if (cell.tag)
    return (
      <>
        {cell.text && <span className="ft-fig">{cell.text}</span>}
        <span className={`tag ${cell.tag.accent ? 'tag-trail' : 'tag-eod'}`} title={cell.tag.title}>
          {cell.tag.label}
        </span>
      </>
    );
  if (cell.note) return <span className="ft-sentence">{cell.text}</span>;
  if (cell.muted) return <span className="none">{cell.text}</span>;
  // Figures read in mono, words ("Locks at start balance", "Daily") in the body face.
  return (
    <span className={/^[\d$+\-–]/.test(cell.text) ? 'ft-fig' : 'ft-word'}>
      {cell.text}
      {cell.soft && (
        <span className="soft-flag" title="Soft breach: position flattened, account not lost">
          soft
        </span>
      )}
    </span>
  );
}

function PriceView({ cell }: { cell: PriceCell }) {
  if (cell == null) return <span className="none" aria-label="Not offered">–</span>;
  if (cell.kind === 'text') return <span className="none">{cell.text}</span>;
  return (
    <>
      <span className="ft-price">
        {cell.from && <span className="price-from">from </span>}
        <span className="ft-now">{money(cell.now)}</span>
        {cell.per && <span className="per">{cell.per}</span>}
        {cell.was != null && (
          <s className="price-was">
            <span className="sr-only">normal price </span>
            {money(cell.was)}
          </s>
        )}
        {cell.alt && (
          <>
            <span className="price-sep" aria-hidden="true">/</span>
            <span className="ft-now">{money(cell.alt.now)}</span>
            {cell.alt.was != null && (
              <s className="price-was">
                <span className="sr-only">normal price </span>
                {money(cell.alt.was)}
              </s>
            )}
          </>
        )}
      </span>
      {cell.lines.length > 0 && (
        <span className="ft-lines">
          {cell.lines.map(({ label, cell: c }) => (
            <span key={label} className="ft-line">
              <span className="ft-line-k">{label}</span> <CellView cell={c} />
            </span>
          ))}
        </span>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
function clock(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m ${pad(s % 60)}s`;
}

// Ticks on its own so the rest of the page does not re-render every second. Before
// hydration it prints a placeholder of the same width as the real clock.
export function PromoClock({ endsMs }: { endsMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (Date.now() >= endsMs) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsMs) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsMs]);
  return (
    <span className="perps-clock" role="timer" aria-live="off">
      {now == null ? '--h --m --s' : clock(endsMs - now)}
    </span>
  );
}

export function FirmTable({ firm, id, banner }: { firm: FirmView; id: string; banner?: React.ReactNode }) {
  const [pi, setPi] = useState(0);
  const [mode, setMode] = useState<'eval' | 'funded'>('eval');
  const cols = firm.columns.length;
  const funded = firm.funded?.[pi] ?? null;
  const hasFunded = !!firm.funded?.some(Boolean);
  const showFunded = mode === 'funded' && funded != null;

  const sizes = firm.sizes.filter((r) => r.cells[pi] != null);
  const priceOf = (r: (typeof sizes)[number]) => r.cells[pi] as Exclude<PriceCell, null>;
  const lineLabels = [
    ...new Set(sizes.flatMap((r) => { const c = priceOf(r); return c.kind === 'price' ? c.lines.map((l) => l.label) : []; })),
  ];
  const evalPills: Pill[] = [
    ...firm.common.map((t) => ({ label: t })),
    // A rule this program does not have ("–") is not a pill.
    // A drawdown-kind cell carries its value in its tag (EOD Trail, Static), not in its text.
    ...firm.rules
      .filter((r) => r.cells[pi].text !== '–')
      .map((r) => ({ label: r.label, value: r.cells[pi].text || r.cells[pi].tag?.label })),
  ];
  const pills = showFunded ? funded.pills : evalPills;

  return (
    <div className="ft" id={id} role="region" aria-label={`${firm.name} plans`}>
      <header className="ft-head">
        <div className="ft-id">
          <FirmLogo firm={firm} size={36} />
          <div>
            <h3 className="ft-title">{firm.name}</h3>
            <p className="ft-sub">
              {cols} program{cols > 1 ? 's' : ''}{firm.summary ? ` · ${firm.summary}` : ''}
            </p>
          </div>
        </div>
        <div className="ft-actions">
          {firm.code && (
            <span className="promo-chip" title={firm.code.title}>
              code {firm.code.code}
            </span>
          )}
          {firm.stale && (
            <span className="stale-chip" title={firm.stale.title}>
              {firm.stale.label}
            </span>
          )}
          <a className="row-cta" href={firm.href} target="_blank" rel="noopener nofollow sponsored">
            Get funded
            <Arrow />
          </a>
        </div>
      </header>

      {banner}

      {(cols > 1 || hasFunded) && (
        // One bar for every filter: the programs, then Eval / Funded after a rule (Angelo,
        // 12/10/2026, picking « tout dans une seule barre »).
        <div className="ft-bar">
          <div className="ft-filters">
            {cols > 1 && (
              <div className="ft-seg" role="tablist" aria-label={`${firm.name} programs`}>
                {firm.columns.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    role="tab"
                    aria-selected={pi === i}
                    className={`ft-prog${pi === i ? ' active' : ''}`}
                    onClick={() => setPi(i)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {cols > 1 && hasFunded && <span className="ft-divider" aria-hidden="true" />}
            {hasFunded && (
              <div className="ft-seg" role="group" aria-label="Evaluation or funded rules">
                {(['eval', 'funded'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    className={`ft-prog${mode === m ? ' active' : ''}`}
                    onClick={() => setMode(m)}
                  >
                    {m === 'eval' ? 'Eval' : 'Funded'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'funded' && funded == null ? (
        <p className="ft-empty">Funded rules for this program aren&apos;t written here yet.</p>
      ) : (
        <ul className="ft-pills" aria-label={showFunded ? 'Funded rules' : 'Evaluation rules'}>
          {pills.map((p) => (
            <li key={p.label} className="ft-pill">
              <Check />
              <span className="ft-pill-k">{p.label}</span>
              {p.value && <span className="ft-pill-v">{p.value}</span>}
            </li>
          ))}
        </ul>
      )}

      {(!showFunded || funded.rows.length > 0) && (
        <div className="ft-scroll" tabIndex={0} role="group" aria-label={`${firm.name} sizes, scrolls sideways`}>
          <table className="ft-table ft-sizes">
            <thead>
              <tr>
                <th className="ft-label" scope="col">
                  <span className="sr-only">Rule</span>
                </th>
                {sizes.map((r) => (
                  <th key={r.size} scope="col" className="ft-col ft-col--size">
                    {sizeLabel(r.size)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showFunded ? (
                funded.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="ft-label">{row.label}</th>
                    {sizes.map((r) => (
                      <td key={r.size} className="ft-cell">
                        <span className="ft-fig">{row.bySize[r.size] ?? '–'}</span>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <>
                  <tr className="ft-row-price">
                    <th scope="row" className="ft-label">
                      {firm.priceLabel ?? firm.priceTitle}
                      {firm.priceLabel ? (
                        <span className="ft-col-sub">{firm.priceSub ?? firm.priceTitle}</span>
                      ) : (
                        firm.priceSub && <span className="ft-col-sub">{firm.priceSub}</span>
                      )}
                    </th>
                    {sizes.map((r) => {
                      const c = priceOf(r);
                      return (
                        <td key={r.size} className="ft-cell">
                          <PriceView cell={c.kind === 'price' ? { ...c, lines: [] } : c} />
                        </td>
                      );
                    })}
                  </tr>
                  {(firm.extraPrices ?? [])
                    .filter((x) => x.byProgram[pi])
                    .map((x) => (
                      <tr key={x.label} className="ft-row-price">
                        <th scope="row" className="ft-label">{x.label}</th>
                        {sizes.map((r) => {
                          const p = x.byProgram[pi]?.[r.size];
                          return (
                            <td key={r.size} className="ft-cell">
                              {p ? (
                                <PriceView cell={{ kind: 'price', now: p.now, was: p.was, per: null, from: false, lines: [] }} />
                              ) : (
                                <span className="none">–</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  {lineLabels.map((l) => (
                    <tr key={l}>
                      <th scope="row" className="ft-label">{l}</th>
                      {sizes.map((r) => {
                        const c = priceOf(r);
                        const cell = c.kind === 'price' ? c.lines.find((x) => x.label === l)?.cell : undefined;
                        return (
                          <td key={r.size} className="ft-cell">
                            {cell ? <CellView cell={cell} /> : <span className="none">–</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {firm.legend.length > 0 && (
        <footer className="ft-foot">
          <div className="legend">
            {firm.legend.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
