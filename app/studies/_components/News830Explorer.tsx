'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAsset } from './AssetContext';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────── */

interface News830Row {
  year: string;
  variant: 'no_be' | 'be_50' | 'tp1_be';
  smt: boolean;
  side: 'BOTH' | 'LONG' | 'SHORT';
  n: number;
  w: number;
  l: number;
  be: number;
  wr: number;
  pf: number;
  net_pts: number;
  avg_win: number;
  avg_loss: number;
}

interface News830Meta {
  source: string;
  date_from: string;
  date_to: string;
  n_events_total: number;
}

interface News830Data {
  meta: News830Meta;
  rows: News830Row[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mock data — used while real JSON is not yet deployed
   ───────────────────────────────────────────────────────────────────────── */

const MOCK: News830Data = {
  meta: {
    source: 'NQ + ES continuous (Databento)',
    date_from: '2022-09-01',
    date_to: '2026-05-09',
    n_events_total: 46,
  },
  rows: [
    { year: 'ALL', variant: 'no_be',   smt: false, side: 'BOTH',  n: 28, w: 11, l: 17, be: 0, wr: 0.393, pf: 1.08, net_pts:   28.75, avg_win:  35.14, avg_loss: -21.04 },
    { year: 'ALL', variant: 'no_be',   smt: true,  side: 'BOTH',  n: 21, w: 11, l: 10, be: 0, wr: 0.524, pf: 1.79, net_pts:  171.0,  avg_win:  35.14, avg_loss: -21.50 },
    { year: 'ALL', variant: 'be_50',   smt: false, side: 'BOTH',  n: 28, w:  9, l: 15, be: 4, wr: 0.321, pf: 0.87, net_pts:  -43.25, avg_win:  33.11, avg_loss: -22.75 },
    { year: '2025', variant: 'no_be',  smt: true,  side: 'BOTH',  n:  5, w:  4, l:  1, be: 0, wr: 0.80,  pf: 3.16, net_pts:  133.0,  avg_win:  36.00, avg_loss: -13.00 },
    { year: '2023', variant: 'no_be',  smt: true,  side: 'BOTH',  n:  9, w:  3, l:  6, be: 0, wr: 0.333, pf: 1.65, net_pts:   57.8,  avg_win:  34.20, avg_loss: -18.90 },
    { year: '2024', variant: 'no_be',  smt: true,  side: 'BOTH',  n:  4, w:  3, l:  1, be: 0, wr: 0.75,  pf: 0.92, net_pts:   -3.8,  avg_win:  32.00, avg_loss: -38.00 },
    { year: '2022', variant: 'no_be',  smt: false, side: 'BOTH',  n:  2, w:  0, l:  2, be: 0, wr: 0.00,  pf: 0.00, net_pts:  -20.5,  avg_win:   0.00, avg_loss: -10.25 },
    { year: '2026', variant: 'no_be',  smt: false, side: 'BOTH',  n:  2, w:  1, l:  1, be: 0, wr: 0.50,  pf: 0.62, net_pts:   -2.3,  avg_win:  14.50, avg_loss: -16.80 },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */

const VARIANT_LABELS: Record<string, string> = {
  no_be:   'No BE',
  be_50:   'BE 50%',
  tp1_be:  'TP1 50% + BE',
};

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtPf(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return '—';
  return v.toFixed(2);
}

function fmtPts(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)} pts`;
}

function fmtAvg(win: number | null | undefined, loss: number | null | undefined): string {
  const w = win == null || !isFinite(win) ? '—' : `+${win.toFixed(1)}`;
  const l = loss == null || !isFinite(loss) ? '—' : loss.toFixed(1);
  return `${w} / ${l}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Segmented control
   ───────────────────────────────────────────────────────────────────────── */

interface SegOption<T> {
  value: T;
  label: string;
}

function SegControl<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="n8-seg" role="group">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`n8-seg-btn${value === opt.value ? ' n8-seg-btn--active' : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main widget
   ───────────────────────────────────────────────────────────────────────── */

type Variant = 'no_be' | 'be_50' | 'tp1_be';
type Side = 'BOTH' | 'LONG' | 'SHORT';

const VARIANT_OPTIONS: SegOption<Variant>[] = [
  { value: 'no_be',  label: 'No BE' },
  { value: 'be_50',  label: 'BE 50%' },
  { value: 'tp1_be', label: 'TP1 50% + BE' },
];

const SIDE_OPTIONS: SegOption<Side>[] = [
  { value: 'BOTH',  label: 'Both' },
  { value: 'LONG',  label: 'Long' },
  { value: 'SHORT', label: 'Short' },
];

const YEAR_OPTIONS = ['ALL', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'] as const;
type Year = (typeof YEAR_OPTIONS)[number];

interface News830ExplorerProps {
  dataUrl: string;
  pdfTitle: string;
  dataUrlGc?: string;
  pdfTitleGc?: string;
}

export default function News830Explorer({ dataUrl, pdfTitle, dataUrlGc, pdfTitleGc }: News830ExplorerProps) {
  const { asset } = useAsset();
  const activeUrl = (asset === 'gc' && dataUrlGc) ? dataUrlGc : dataUrl;
  const activePdfTitle = (asset === 'gc' && pdfTitleGc) ? pdfTitleGc : pdfTitle;
  const smtLabel = asset === 'gc' ? 'SI SMT' : 'ES SMT';
  const datasetLabel = asset === 'gc' ? 'GC continuous' : 'NQ continuous';

  const [data, setData]       = useState<News830Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);

  // filter state
  const [variant, setVariant] = useState<'no_be' | 'be_50' | 'tp1_be'>('no_be');
  const [smt, setSmt]         = useState<boolean>(false);
  const [side, setSide]       = useState<'BOTH' | 'LONG' | 'SHORT'>('BOTH');
  const [year, setYear]       = useState<Year>('ALL');

  // view state
  type ViewMode = 'TABLE' | 'RANKING' | 'BEST';
  const [view, setView]               = useState<ViewMode>('TABLE');
  const [showAllRanking, setShowAllRanking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUsingMock(false);
    fetch(activeUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<News830Data>;
      })
      .then((j) => {
        if (cancelled) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to mock while real data isn't deployed yet
        setData(MOCK);
        setUsingMock(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeUrl]);

  /* ── filtered row (selected combo) ─────────────────────────────────────── */

  const row: News830Row | undefined = useMemo(() => {
    if (!data) return undefined;
    return data.rows.find(
      (r) =>
        r.year    === year    &&
        r.variant === variant &&
        r.smt     === smt     &&
        r.side    === side,
    );
  }, [data, year, variant, smt, side]);

  /* ── year-by-year breakdown rows for the selected variant/smt/side ─────── */

  const yearBreakdownRows: News830Row[] = useMemo(() => {
    if (!data) return [];
    const years = year === 'ALL'
      ? YEAR_OPTIONS.filter((y) => y !== 'ALL')
      : [year];
    return years.map((y) =>
      data.rows.find(
        (r) => r.year === y && r.variant === variant && r.smt === smt && r.side === side,
      )
    ).filter((r): r is News830Row => r !== undefined);
  }, [data, variant, smt, side, year]);

  /* ── combos in scope (for RANKING / BEST) ──────────────────────────────── */

  interface N8Combo {
    variant: Variant;
    smt: boolean;
    side: Side;
    n: number;
    w: number;
    l: number;
    be: number;
    wr: number;
    pf: number;
    net_pts: number;
    avg_win: number;
    avg_loss: number;
  }

  const combosInScope: N8Combo[] = useMemo(() => {
    if (!data) return [];
    const scopeYear = year === 'ALL' ? 'ALL' : year;
    return data.rows
      .filter((r) => r.year === scopeYear)
      .map((r) => ({
        variant: r.variant,
        smt: r.smt,
        side: r.side,
        n: r.n,
        w: r.w,
        l: r.l,
        be: r.be,
        wr: r.wr,
        pf: r.pf,
        net_pts: r.net_pts,
        avg_win: r.avg_win,
        avg_loss: r.avg_loss,
      }));
  }, [data, year]);

  const rankingRows: N8Combo[] = useMemo(() => {
    return [...combosInScope].sort((a, b) => {
      if (b.net_pts !== a.net_pts) return b.net_pts - a.net_pts;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return b.n - a.n;
    });
  }, [combosInScope]);

  const bestCombo: N8Combo | null = useMemo(() => {
    return rankingRows.length > 0 ? rankingRows[0] : null;
  }, [rankingRows]);

  /* ── human-readable filter summary ─────────────────────────────────────── */

  const filterLabel = `${VARIANT_LABELS[variant]} · SMT ${smt ? 'on' : 'off'} · ${side} · ${year === 'ALL' ? 'All years' : year}`;

  /* ── PDF: Custom (current filters) ─────────────────────────────────────── */

  async function downloadCustomPdf() {
    if (!data || !row) return;
    setGeneratingCustom(true);
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableMod.default;

      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageW = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().slice(0, 10);

      // Cover
      doc.setFont('times', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(20);
      doc.text(`${activePdfTitle} — Custom Report`, 40, 80);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(80);
      doc.text('Generated by jacktradesnq.com — interactive explorer', 40, 102);
      doc.text(`Date generated: ${today}`, 40, 118);

      // Divider
      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.line(40, 138, pageW - 40, 138);

      // Filters block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text('FILTERS APPLIED', 40, 160);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const filterLines = [
        `• Variant: ${VARIANT_LABELS[variant]}`,
        `• ${smtLabel}: ${smt ? 'On' : 'Off'}`,
        `• Side: ${side}`,
        `• Year: ${year === 'ALL' ? 'All years (2022–2026)' : year}`,
      ];
      filterLines.forEach((line, i) => {
        doc.text(line, 50, 182 + i * 18);
      });

      // Summary block
      const sy = 182 + filterLines.length * 18 + 24;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text('SUMMARY', 40, sy);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const summaryLines = [
        `Trades: ${row.n}`,
        `Win Rate: ${fmtPct(row.wr)}`,
        `Profit Factor: ${fmtPf(row.pf)}`,
        `Net P&L: ${fmtPts(row.net_pts)}`,
        `Avg Win: +${row.avg_win.toFixed(1)} pts`,
        `Avg Loss: ${row.avg_loss.toFixed(1)} pts`,
      ];
      summaryLines.forEach((line, i) => {
        doc.text(line, 50, sy + 22 + i * 18);
      });

      // Table: year-by-year breakdown
      const tableStartY = sy + 22 + summaryLines.length * 18 + 28;

      const head = [['Year', 'Trades', 'W', 'L', 'BE', 'WR', 'PF', 'Net (pts)']];
      const body = yearBreakdownRows.map((r) => [
        r.year,
        String(r.n),
        String(r.w),
        String(r.l),
        String(r.be),
        fmtPct(r.wr),
        fmtPf(r.pf),
        (r.net_pts > 0 ? '+' : '') + r.net_pts.toFixed(1),
      ]);

      autoTable(doc, {
        head,
        body,
        startY: tableStartY,
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 246, 240] },
        margin: { left: 40, right: 40 },
      });

      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `jacktradesnq.com  ·  ${activePdfTitle.toLowerCase()} interactive explorer  ·  ${today}  ·  Page ${p}/${pageCount}`,
          40,
          doc.internal.pageSize.getHeight() - 24,
        );
      }

      const slugifiedTitle = activePdfTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const filename = `${slugifiedTitle}-custom-${variant}-${smt ? 'smtON' : 'smtOFF'}-${side}-${year}-${today}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('PDF generation failed', e);
      alert(`Could not generate PDF: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setGeneratingCustom(false);
    }
  }

  /* ── PDF: All totals ────────────────────────────────────────────────────── */

  async function downloadAllPdf() {
    if (!data) return;
    setGeneratingAll(true);
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableMod.default;

      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageW = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().slice(0, 10);

      // Cover header (top of page 1, table follows immediately below)
      doc.setFont('times', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(20);
      doc.text(`${activePdfTitle} — Full Report`, 40, 80);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(80);
      doc.text('Generated by jacktradesnq.com — interactive explorer', 40, 102);
      doc.text(`Date generated: ${today}`, 40, 118);

      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.line(40, 134, pageW - 40, 134);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text('SCOPE', 40, 156);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`• ${data.meta.n_events_total} events in window ${data.meta.date_from} -> ${data.meta.date_to}`, 50, 178);
      doc.text(`• 216 combos: 3 variants × 2 SMT × 3 sides × 12 buckets (2016-2026 + ALL)`, 50, 196);
      doc.text(`• Source: ${data.meta.source}`, 50, 214);

      // 6 tables: one per variant × SMT combo. First table sits on cover page.
      const variants: Variant[] = ['no_be', 'be_50', 'tp1_be'];
      const smtValues: [boolean, string][] = [[false, 'SMT Off'], [true, 'SMT On']];
      const sides: Side[] = ['BOTH', 'LONG', 'SHORT'];
      const years = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026', 'ALL'];

      let isFirst = true;
      for (const v of variants) {
        for (const [smtVal, smtLabel] of smtValues) {
          if (!isFirst) doc.addPage();

          doc.setFont('times', 'bold');
          doc.setFontSize(18);
          doc.setTextColor(20);
          doc.text(`${VARIANT_LABELS[v]} — ${smtLabel}`, 40, isFirst ? 250 : 64);

          const head = [['Year', 'Side', 'N', 'W', 'L', 'BE', 'WR', 'PF', 'Net (pts)']];
          const body: string[][] = [];

          for (const yr of years) {
            for (const sd of sides) {
              const r = data.rows.find(
                (row) => row.year === yr && row.variant === v && row.smt === smtVal && row.side === sd,
              );
              if (r) {
                body.push([
                  yr === 'ALL' ? 'All years' : yr,
                  sd,
                  String(r.n),
                  String(r.w),
                  String(r.l),
                  String(r.be),
                  fmtPct(r.wr),
                  fmtPf(r.pf),
                  (r.net_pts > 0 ? '+' : '') + r.net_pts.toFixed(1),
                ]);
              }
            }
          }

          autoTable(doc, {
            head,
            body,
            startY: isFirst ? 278 : 92,
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 246, 240] },
            margin: { left: 40, right: 40 },
          });
          isFirst = false;
        }
      }

      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `jacktradesnq.com  ·  ${activePdfTitle.toLowerCase()} interactive explorer  ·  ${today}  ·  Page ${p}/${pageCount}`,
          40,
          doc.internal.pageSize.getHeight() - 24,
        );
      }

      const slugifiedTitle = activePdfTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      doc.save(`${slugifiedTitle}-full-${today}.pdf`);
    } catch (e) {
      console.error('PDF generation failed', e);
      alert(`Could not generate PDF: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setGeneratingAll(false);
    }
  }

  /* ── render ─────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="bd-explorer-loading">Loading dataset…</div>
    );
  }

  const netColor =
    row && row.net_pts > 0
      ? 'oklch(0.50 0.15 82)'
      : row && row.net_pts < 0
      ? 'oklch(0.50 0.105 42)'
      : 'inherit';

  return (
    <section className="n8-explorer">
      {/* ── styles scoped inside this section ─────────────────────────── */}
      <style>{`
        .n8-explorer {
          margin-top: 48px;
          padding: 32px;
          background: var(--c-surface-card);
          border: 1px solid var(--c-border);
          border-radius: 16px;
          max-width: 720px;
        }
        .n8-explorer-hd {
          font-family: var(--f-serif);
          font-weight: 700;
          font-size: 1.25rem;
          letter-spacing: -0.01em;
          color: var(--c-ink);
          margin-bottom: 4px;
        }
        .n8-explorer-sub {
          font-family: var(--f-sans);
          font-size: 0.8rem;
          color: var(--c-muted);
          margin-bottom: 24px;
        }
        .n8-filter-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 24px;
          margin-bottom: 20px;
        }
        @media (max-width: 560px) {
          .n8-filter-grid { grid-template-columns: 1fr; }
        }
        .n8-filter-row { display: flex; flex-direction: column; gap: 6px; }
        .n8-filter-lbl {
          font-family: var(--f-sans);
          font-weight: 700;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--c-muted);
        }
        .n8-seg {
          display: inline-flex;
          border: 1px solid var(--c-border);
          border-radius: 999px;
          padding: 3px;
          background: var(--c-surface);
          gap: 2px;
        }
        .n8-seg-btn {
          flex: 1;
          padding: 7px 14px;
          font-family: var(--f-sans);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--c-muted);
          background: transparent;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
          white-space: nowrap;
        }
        .n8-seg-btn:hover { color: var(--c-ink); }
        .n8-seg-btn--active {
          background: #1c1812;
          color: var(--c-ink);
          font-weight: 700;
          box-shadow: 0 1px 2px oklch(0.16 0.02 165 / 0.10), 0 2px 6px oklch(0.16 0.02 165 / 0.06);
        }
        .n8-seg-btn--active:hover { background: #1c1812; }
        .n8-seg-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
        .n8-switch {
          position: relative;
          width: 44px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid var(--c-border);
          background: var(--c-surface);
          cursor: pointer;
          padding: 0;
          transition: background 180ms ease, border-color 180ms ease;
        }
        .n8-switch:hover { background: var(--c-surface-hover); }
        .n8-switch--on { background: var(--c-accent); border-color: var(--c-accent); }
        .n8-switch--on:hover { background: var(--c-accent-deep); border-color: var(--c-accent-deep); }
        .n8-switch-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #1c1812;
          box-shadow: 0 1px 2px oklch(0.16 0.02 165 / 0.20);
          transition: transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1);
        }
        .n8-switch--on .n8-switch-thumb { transform: translateX(20px); }
        .n8-switch:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
        .n8-year-select {
          font: inherit;
          font-family: var(--f-sans);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--c-ink);
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 6px;
          padding: 7px 28px 7px 10px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>");
          background-repeat: no-repeat;
          background-position: right 10px center;
          transition: border-color 150ms ease;
        }
        .n8-year-select:hover { border-color: var(--c-accent); }
        .n8-year-select:focus-visible {
          outline: none;
          border-color: var(--c-accent);
          box-shadow: 0 0 0 3px oklch(0.86 0.17 95 / 0.25);
        }
        .n8-filter-summary {
          font-family: var(--f-sans);
          font-size: 0.75rem;
          color: var(--c-muted);
          margin-bottom: 20px;
          padding: 8px 12px;
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 6px;
          letter-spacing: 0.01em;
        }
        .n8-filter-summary strong {
          color: var(--c-ink);
          font-weight: 600;
        }
        .n8-stat-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }
        @media (max-width: 680px) {
          .n8-stat-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 420px) {
          .n8-stat-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .n8-stat-card {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 14px 12px;
          background: var(--c-surface);
          border: 1px solid var(--c-border);
          border-radius: 10px;
        }
        .n8-stat-lbl {
          font-family: var(--f-sans);
          font-weight: 700;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--c-muted);
        }
        .n8-stat-val {
          font-family: var(--f-serif);
          font-weight: 700;
          font-size: 1.5rem;
          color: var(--c-ink);
          letter-spacing: -0.015em;
          line-height: 1.1;
        }
        .n8-stat-val--sm {
          font-size: 1.05rem;
        }
        .n8-no-data {
          font-family: var(--f-sans);
          font-size: 0.875rem;
          color: var(--c-muted);
          font-style: italic;
          padding: 24px 0 8px;
          text-align: center;
        }
        .n8-mock-badge {
          display: inline-block;
          font-family: var(--f-sans);
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: oklch(0.58 0.10 82);
          background: oklch(0.17 0.03 165);
          border: 1px solid oklch(0.17 0.03 165);
          border-radius: 4px;
          padding: 2px 7px;
          margin-left: 8px;
          vertical-align: middle;
        }
        .n8-disclaimer {
          font-family: var(--f-sans);
          font-size: 0.75rem;
          color: var(--c-muted);
          font-style: italic;
          margin-top: 16px;
          line-height: 1.6;
        }
        .n8-year-table-wrap {
          margin-top: 20px;
          margin-bottom: 8px;
          border: 1px solid var(--c-border);
          border-radius: 12px;
          overflow: auto;
          background: var(--c-surface-card);
        }
        .n8-year-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--f-sans);
          font-size: 0.875rem;
        }
        .n8-year-table th,
        .n8-year-table td {
          padding: 9px 12px;
          text-align: right;
          border-bottom: 1px solid var(--c-border);
        }
        .n8-year-table th:first-child,
        .n8-year-table td:first-child { text-align: left; }
        .n8-year-table thead th {
          position: sticky;
          top: 0;
          background: var(--c-surface-raised);
          font-weight: 700;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--c-muted);
          z-index: 1;
        }
        .n8-year-table tbody tr:hover { background: var(--c-surface-hover); }
        .n8-year-table tbody tr:last-child td { border-bottom: 0; }
        .n8-year-table tr[data-highlighted="true"] td {
          background: oklch(0.92 0.03 82);
        }
        .n8-year-table tr[data-highlighted="true"]:hover td {
          background: oklch(0.89 0.04 82);
        }
        .n8-downloads {
          margin-top: 32px;
          padding: 20px 0 4px;
          border-top: 1px solid #2c2620;
        }
        .n8-downloads-label {
          font-family: var(--f-sans);
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--c-muted);
          margin-bottom: 12px;
        }
        .n8-pdf-btns {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .n8-pdf-btns button.bd-btn {
          height: 44px;
          padding: 0 22px;
          border-radius: 999px;
          cursor: pointer;
        }
        .n8-pdf-btns button.bd-btn-primary {
          background: var(--c-accent);
          color: oklch(0.20 0.02 70);
          border: 1px solid var(--c-accent);
        }
        .n8-pdf-btns button.bd-btn-primary:hover:not(:disabled) {
          background: var(--c-accent-deep);
          border-color: var(--c-accent-deep);
        }
        .n8-pdf-btns button.bd-btn-secondary {
          background: transparent;
          color: var(--c-accent-deep);
          border: 1.5px solid var(--c-accent);
        }
        .n8-pdf-btns button.bd-btn-secondary:hover:not(:disabled) {
          background: var(--c-accent);
          color: oklch(0.20 0.02 70);
        }
        .n8-pdf-btns button.bd-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="n8-explorer-hd">
        Interactive explorer
        {usingMock && <span className="n8-mock-badge">preview data</span>}
      </div>
      <div className="n8-explorer-sub">
        Toggle filters — stat cards update instantly.
      </div>

      {/* ── filters ───────────────────────────────────────────────────── */}
      <div className="bd-filters">
        <label className="bd-filter">
          <span className="bd-filter-lbl">Variant</span>
          <select
            className="bd-select"
            value={variant}
            onChange={(e) => setVariant(e.target.value as Variant)}
          >
            {VARIANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="bd-filter">
          <span className="bd-filter-lbl">{smtLabel}</span>
          <select
            className="bd-select"
            value={smt ? 'on' : 'off'}
            onChange={(e) => setSmt(e.target.value === 'on')}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </label>

        <label className="bd-filter">
          <span className="bd-filter-lbl">Side</span>
          <select
            className="bd-select"
            value={side}
            onChange={(e) => setSide(e.target.value as Side)}
          >
            {SIDE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="bd-filter">
          <span className="bd-filter-lbl">Year</span>
          <select
            className="bd-select"
            value={year}
            onChange={(e) => setYear(e.target.value as Year)}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y === 'ALL' ? 'All years' : y}</option>
            ))}
          </select>
        </label>

        <div className="bd-filter">
          <span className="bd-filter-lbl">View</span>
          <div className="bd-view-toggle">
            <button
              type="button"
              className={`bd-view-btn${view === 'TABLE' ? ' bd-view-btn-active' : ''}`}
              onClick={() => setView('TABLE')}
            >
              Table
            </button>
            <button
              type="button"
              className={`bd-view-btn${view === 'RANKING' ? ' bd-view-btn-active' : ''}`}
              onClick={() => setView('RANKING')}
            >
              Ranking
            </button>
            <button
              type="button"
              className={`bd-view-btn${view === 'BEST' ? ' bd-view-btn-active' : ''}`}
              onClick={() => setView('BEST')}
            >
              Best
            </button>
          </div>
        </div>
      </div>

      {/* ── active filter summary ──────────────────────────────────────── */}
      <div className="n8-filter-summary">
        <strong>Showing:</strong> {filterLabel}
      </div>

      {/* ── TABLE view ────────────────────────────────────────────────── */}
      {view === 'TABLE' && (
        <>
          {/* stat cards */}
          {!row ? (
            <div className="n8-no-data">
              No data for this combination — try a different filter.
            </div>
          ) : (
            <div className="n8-stat-grid">
              <div className="n8-stat-card">
                <span className="n8-stat-lbl">Trades</span>
                <span className="n8-stat-val">{row.n}</span>
              </div>

              <div className="n8-stat-card">
                <span className="n8-stat-lbl">Win Rate</span>
                <span className="n8-stat-val">{fmtPct(row.wr)}</span>
              </div>

              <div className="n8-stat-card">
                <span className="n8-stat-lbl">Profit Factor</span>
                <span className="n8-stat-val">{fmtPf(row.pf)}</span>
              </div>

              <div className="n8-stat-card">
                <span className="n8-stat-lbl">Net P&amp;L</span>
                <span
                  className="n8-stat-val"
                  style={{ color: netColor }}
                >
                  {fmtPts(row.net_pts)}
                </span>
              </div>

              <div className="n8-stat-card">
                <span className="n8-stat-lbl">Avg Win / Avg Loss</span>
                <span className="n8-stat-val n8-stat-val--sm">
                  {fmtAvg(row.avg_win, row.avg_loss)}
                </span>
              </div>
            </div>
          )}

          {/* year-by-year breakdown table */}
          {yearBreakdownRows.length > 0 && (
            <div className="n8-year-table-wrap">
              <table className="n8-year-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Trades</th>
                    <th>W</th>
                    <th>L</th>
                    <th>BE</th>
                    <th>WR</th>
                    <th>PF</th>
                    <th>Net (pts)</th>
                  </tr>
                </thead>
                <tbody>
                  {yearBreakdownRows.map((r) => {
                    const netCol =
                      r.net_pts > 0
                        ? 'oklch(0.50 0.15 82)'
                        : r.net_pts < 0
                        ? 'oklch(0.50 0.105 42)'
                        : 'inherit';
                    const isHighlighted = year !== 'ALL' && r.year === year;
                    return (
                      <tr key={r.year} data-highlighted={isHighlighted ? 'true' : 'false'}>
                        <td>{r.year}</td>
                        <td>{r.n}</td>
                        <td>{r.w}</td>
                        <td>{r.l}</td>
                        <td>{r.be}</td>
                        <td>{fmtPct(r.wr)}</td>
                        <td>{fmtPf(r.pf)}</td>
                        <td style={{ color: netCol, fontWeight: 600 }}>
                          {(r.net_pts > 0 ? '+' : '') + r.net_pts.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── RANKING view ──────────────────────────────────────────────── */}
      {view === 'RANKING' && (
        <div className="bd-ranking-wrap">
          <p className="bd-ranking-caption">
            Ranked by net pts{year !== 'ALL' ? ` in ${year}` : ' (all years)'}
          </p>
          <div className="bd-table-wrap">
            <table className="bd-data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Variant</th>
                  <th>{smtLabel}</th>
                  <th>Side</th>
                  <th>N</th>
                  <th>WR</th>
                  <th>PF</th>
                  <th>Net pts</th>
                </tr>
              </thead>
              <tbody>
                {rankingRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24, opacity: 0.6 }}>
                      No combos in scope.
                    </td>
                  </tr>
                ) : (
                  (showAllRanking ? rankingRows : rankingRows.slice(0, 3)).map((r, i) => (
                    <tr
                      key={`rank-${r.variant}-${String(r.smt)}-${r.side}`}
                      className={i < 3 ? 'bd-ranking-top3' : undefined}
                    >
                      <td className="bd-ranking-rank">{i + 1}</td>
                      <td>{VARIANT_LABELS[r.variant]}</td>
                      <td>{r.smt ? 'On' : 'Off'}</td>
                      <td>{r.side}</td>
                      <td>{r.n}</td>
                      <td>{fmtPct(r.wr)}</td>
                      <td
                        className={
                          r.pf > 1
                            ? 'bd-ranking-pos'
                            : r.pf < 1
                            ? 'bd-ranking-neg'
                            : undefined
                        }
                      >
                        {fmtPf(r.pf)}
                      </td>
                      <td
                        className={
                          r.net_pts > 0
                            ? 'bd-ranking-pos'
                            : r.net_pts < 0
                            ? 'bd-ranking-neg'
                            : undefined
                        }
                      >
                        {(r.net_pts > 0 ? '+' : '') + r.net_pts.toFixed(1)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {rankingRows.length > 3 && (
            <button
              type="button"
              className="bd-ranking-toggle"
              onClick={() => setShowAllRanking((v) => !v)}
            >
              {showAllRanking
                ? 'Show top 3 only'
                : `Show all ${rankingRows.length} combos`}
            </button>
          )}
        </div>
      )}

      {/* ── BEST view ─────────────────────────────────────────────────── */}
      {view === 'BEST' && (
        <div className="bd-best-wrap">
          {bestCombo === null ? (
            <p className="bd-best-empty">No combo matches your scope.</p>
          ) : (
            <>
              <div className="bd-best-hero">
                <p className="bd-best-hero-headline">
                  Best combo — {asset === 'gc' ? 'GC' : 'NQ'}
                </p>
                <p className="bd-best-hero-subline">
                  {VARIANT_LABELS[bestCombo.variant]}
                  {' · '}
                  {smtLabel} {bestCombo.smt ? 'on' : 'off'}
                  {' · '}
                  {bestCombo.side}
                </p>
                <div className="bd-stat-grid bd-best-hero-stats">
                  <div className="bd-stat-card">
                    <span className="bd-stat-card-lbl">Net P&amp;L</span>
                    <span
                      className={`bd-stat-card-num bd-stat-card-num-sm ${bestCombo.net_pts > 0 ? 'bd-ranking-pos' : bestCombo.net_pts < 0 ? 'bd-ranking-neg' : ''}`}
                    >
                      {bestCombo.net_pts >= 0 ? '+' : ''}{bestCombo.net_pts.toFixed(1)} pts
                    </span>
                  </div>
                  <div className="bd-stat-card">
                    <span className="bd-stat-card-lbl">Avg PnL / event</span>
                    <span
                      className={`bd-stat-card-num bd-stat-card-num-sm ${bestCombo.n > 0 && bestCombo.net_pts / bestCombo.n > 0 ? 'bd-ranking-pos' : bestCombo.n > 0 && bestCombo.net_pts / bestCombo.n < 0 ? 'bd-ranking-neg' : ''}`}
                    >
                      {bestCombo.n > 0
                        ? ((bestCombo.net_pts / bestCombo.n) >= 0 ? '+' : '') + (bestCombo.net_pts / bestCombo.n).toFixed(1)
                        : '—'} pts
                    </span>
                  </div>
                  <div className="bd-stat-card">
                    <span className="bd-stat-card-lbl">Win Rate</span>
                    <span className="bd-stat-card-num bd-stat-card-num-sm">
                      {fmtPct(bestCombo.wr)}
                    </span>
                    <span className="bd-best-sub">
                      {bestCombo.w}W / {bestCombo.l}L / {bestCombo.be}BE
                    </span>
                  </div>
                  <div className="bd-stat-card">
                    <span className="bd-stat-card-lbl">Trades</span>
                    <span className="bd-stat-card-num bd-stat-card-num-sm">
                      {bestCombo.n}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bd-best-footer">
                <p className="bd-best-caption">
                  Selected from {combosInScope.length} combo{combosInScope.length !== 1 ? 's' : ''} in the current scope, ranked by net points.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── download buttons ──────────────────────────────────────────── */}
      <div className="n8-downloads">
        <div className="n8-downloads-label">Downloads</div>
        <div className="n8-pdf-btns">
          <button
            type="button"
            className="bd-btn bd-btn-primary"
            onClick={downloadCustomPdf}
            disabled={generatingCustom || !row}
          >
            {generatingCustom ? 'Generating…' : '↓ Custom PDF (your filters)'}
          </button>
          <button
            type="button"
            className="bd-btn bd-btn-secondary"
            onClick={downloadAllPdf}
            disabled={generatingAll || !data}
          >
            {generatingAll ? 'Generating…' : '↓ Full PDF (all variants)'}
          </button>
        </div>
      </div>

      <p className="n8-disclaimer">
        Backtest on {datasetLabel}. Past performance does not predict future
        results. Sample sizes are small — treat as indicative only, not
        financial advice.
      </p>
    </section>
  );
}
