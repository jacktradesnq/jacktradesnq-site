'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { NavFamily } from '@/lib/study-stats';

interface FamilyCounts {
  total: number;
  news: number;
  ib: number;
  ema: number;
  time: number;
  misc: number;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={'v3-nav-chevron' + (open ? ' open' : '')}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ marginLeft: 'auto', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export default function V3SideNav({ counts, tree }: { counts: FamilyCounts; tree: NavFamily[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCat = searchParams.get('cat');
  const activeEvent = searchParams.get('event');

  const isBasics = pathname.includes('/basics');
  const isCalendar = pathname.includes('/calendar');
  const isMethodology = pathname.includes('/methodology');
  const isData = !isBasics && !isCalendar && !isMethodology;
  const [dataOpen, setDataOpen] = useState(isData);

  // Collapse the Data tree when navigating away from a Data page (Basics/Calendar/Methodology),
  // re-open it when back on a Data page.
  useEffect(() => {
    setDataOpen(isData);
  }, [isData]);

  // Determine which family contains the active event
  const activeFamilyKey = activeEvent
    ? (tree.find((f) => f.events.some((ev) => ev.key === activeEvent))?.family ?? null)
    : null;

  // Per-group open state: collapsed by default, open if it contains the active event
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const fam of tree) {
      const key = fam.family + ':' + fam.label;
      init[key] = fam.family === activeFamilyKey && fam.events.some((ev) => ev.key === activeEvent);
    }
    return init;
  });

  // Re-compute open state when activeEvent changes (navigation)
  useEffect(() => {
    setGroupOpen((prev) => {
      const next: Record<string, boolean> = {};
      for (const fam of tree) {
        const key = fam.family + ':' + fam.label;
        const isActive = fam.events.some((ev) => ev.key === activeEvent);
        // Keep open if already open OR if this group now contains the active event
        next[key] = prev[key] || isActive;
      }
      return next;
    });
  }, [activeEvent, tree]);

  function toggleGroup(fam: NavFamily) {
    const key = fam.family + ':' + fam.label;
    setGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside className="v3-sidenav">
      {/* Basics */}
      <Link
        href="/studies/basics/"
        className={'v3-nav-btn' + (isBasics ? ' active' : '')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.8 }}>
          <path d="M8 4.5C6.4 3.4 4.2 3.2 2.5 3.6v8.2c1.7-.4 3.9-.2 5.5.9 1.6-1.1 3.8-1.3 5.5-.9V3.6C11.8 3.2 9.6 3.4 8 4.5z" strokeLinejoin="round" />
          <path d="M8 4.5v8.6" />
        </svg>
        Basics
      </Link>

      {/* Data (parent) */}
      <button
        type="button"
        onClick={() => setDataOpen((v) => !v)}
        className={'v3-nav-btn v3-nav-btn-toggle' + (isData && !activeCat && !activeEvent ? ' active' : '')}
        aria-expanded={dataOpen}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, opacity: 0.8 }}>
          <rect x="1" y="2" width="14" height="3" rx="1" />
          <rect x="1" y="7" width="14" height="3" rx="1" />
          <rect x="1" y="12" width="14" height="2" rx="1" />
        </svg>
        Data
        <ChevronIcon open={dataOpen} />
      </button>

      {/* Sub-items */}
      {dataOpen && (
      <ul className="v3-nav-sublist">
        {/* All */}
        <li>
          <Link
            href="/studies/"
            className={'v3-nav-sub' + (isData && !activeCat && !activeEvent ? ' active' : '')}
          >
            <span className="v3-nav-sub-dot" aria-hidden="true" />
            All
            <span className="v3-nav-sub-count">({counts.total})</span>
          </Link>
        </li>

        {/* Family groups — each collapsible */}
        {tree.map((fam) => {
          const groupKey = fam.family + ':' + fam.label;
          const isOpen = groupOpen[groupKey] ?? false;
          return (
            <li key={groupKey}>
              <button
                type="button"
                className="v3-nav-grouplbl v3-nav-group-toggle"
                onClick={() => toggleGroup(fam)}
                aria-expanded={isOpen}
              >
                <span className="v3-nav-group-lbl-text">{fam.label}</span>
                <span className="v3-nav-group-count">({fam.events.length})</span>
                <ChevronIcon open={isOpen} />
              </button>
              {isOpen && (
                <ul className="v3-nav-sublist">
                  {fam.events.map((ev) => (
                    <li key={ev.key}>
                      <Link
                        href={`/studies/?event=${ev.key}`}
                        className={'v3-nav-sub' + (activeEvent === ev.key ? ' active' : '')}
                      >
                        <span className="v3-nav-sub-dot" aria-hidden="true" />
                        {ev.label}
                        <span className="v3-nav-sub-count">({ev.count})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      )}

      {/* Calendar */}
      <Link
        href="/studies/calendar/"
        className={'v3-nav-btn' + (isCalendar ? ' active' : '')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.8 }}>
          <rect x="2" y="3" width="12" height="11" rx="1" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <line x1="5" y1="1" x2="5" y2="4" />
          <line x1="11" y1="1" x2="11" y2="4" />
        </svg>
        Calendar
      </Link>

      {/* Methodology */}
      <Link
        href="/studies/methodology/"
        className={'v3-nav-btn' + (isMethodology ? ' active' : '')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.8 }}>
          <circle cx="8" cy="8" r="6.25" />
          <line x1="8" y1="4.5" x2="8" y2="8.5" />
          <circle cx="8" cy="11.25" r="0.6" fill="currentColor" />
        </svg>
        Methodology
      </Link>

      <div className="v3-nav-spacer" />
      <p className="v3-nav-disclaimer">
        Historical backtests on 1-min data. Past performance ≠ future results.
      </p>
    </aside>
  );
}
