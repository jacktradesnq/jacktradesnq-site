'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StudyStats, AssetType, FamilyType } from '@/lib/study-stats';
import { eventKeyOf } from '@/lib/event-key';
import type { DayPlaybook } from '@/lib/today-events';
import { eventFull } from '@/lib/terminology';
import StudyRow from './StudyRow';
import HubTopBar, { type SortBy } from './HubTopBar';

/** Human-readable label for an event key — delegates to terminology.ts */
function eventLabel(key: string): string {
  return eventFull(key);
}

interface EventGroup {
  key: string;
  label: string;
  items: StudyStats[];
  bestPf: number;
}

function groupItems(items: StudyStats[]): EventGroup[] {
  const groupMap = new Map<string, StudyStats[]>();

  for (const s of items) {
    const key = eventKeyOf(s.slug) ?? s.slug;
    const bucket = groupMap.get(key) ?? [];
    bucket.push(s);
    groupMap.set(key, bucket);
  }

  const groups: EventGroup[] = [];

  for (const [key, bucket] of groupMap.entries()) {
    groups.push({
      key,
      label: eventLabel(key),
      items: bucket,
      bestPf: Math.max(...bucket.map((s) => s.pf)),
    });
  }

  groups.sort((a, b) => b.bestPf - a.bestPf);

  return groups;
}

const STORAGE_KEY = 'hub-filters-v3';

type FamilyFilter = FamilyType | 'All';

interface FilterState {
  asset: AssetType | 'All';
  sortBy: SortBy;
  query: string;
  family: FamilyFilter;
}

const DEFAULT_STATE: FilterState = {
  asset: 'All',
  sortBy: 'pf',
  query: '',
  family: 'All',
};

function loadState(): FilterState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) } as FilterState;
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(s: FilterState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

/** Returns 0=Mon … 4=Fri in NY time, or null until mounted */
function getNyDowIndex(): number | null {
  const ny = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
  );
  const jsDay = ny.getDay();
  if (jsDay < 1 || jsDay > 5) return 0;
  return jsDay - 1;
}

export default function HubFilters({
  studies,
  weekly,
}: {
  studies: StudyStats[];
  weekly?: DayPlaybook[];
}) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);
  const [selectedDow, setSelectedDow] = useState<number | null>(null);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setFilters(loadState());
    setMounted(true);
    setSelectedDow(getNyDowIndex());
  }, []);

  useEffect(() => {
    const cat = searchParams.get('cat');
    const event = searchParams.get('event');
    const CAT_TO_FAMILY: Record<string, FamilyType> = { news: 'News', ib: 'IB', ema: 'EMA', time: 'Time', misc: 'Misc' };
    if (event) {
      setFilters((f) => ({ ...f, family: 'All', asset: 'All' }));
      setEventFilter(event);
    } else if (cat && CAT_TO_FAMILY[cat]) {
      setFilters((f) => ({ ...f, family: CAT_TO_FAMILY[cat], asset: 'All' }));
      setEventFilter(null);
    } else if (cat === null) {
      setFilters((f) => ({ ...f, family: 'All' }));
      setEventFilter(null);
    }
    // When the left-nav selects an event/family, the filtered grid sits below the
    // hero (Strongest edges + meta + asset pills) — all outside this component and
    // never filtered. Without scrolling, the visible viewport doesn't change and the
    // click reads as a no-op. Bring the (now-filtered) grid into view.
    if (event || (cat && CAT_TO_FAMILY[cat])) {
      requestAnimationFrame(() => {
        document.getElementById('hub-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (mounted) saveState(filters);
  }, [filters, mounted]);

  const updateFilter = <K extends keyof FilterState>(key: K, val: FilterState[K]) => {
    setFilters((f) => ({ ...f, [key]: val }));
  };

  const clearFamily = useCallback(() => {
    setFilters((f) => ({ ...f, family: 'All' }));
    setEventFilter(null);
    router.push('/studies/', { scroll: false });
  }, [router]);

  const filtered = useMemo(() => {
    let list = [...studies];
    if (filters.asset !== 'All') {
      list = list.filter((s) => s.asset === filters.asset);
    }
    if (filters.family !== 'All') {
      list = list.filter((s) => s.family === filters.family);
    }
    if (eventFilter) {
      list = list.filter((s) => (eventKeyOf(s.slug) ?? s.slug) === eventFilter);
    }
    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const hay = `${s.title} ${s.slug} ${s.asset} ${s.family} ${s.excerpt ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    switch (filters.sortBy) {
      case 'n':
        list.sort((a, b) => b.n - a.n);
        break;
      case 'alpha':
        list.sort((a, b) => a.slug.localeCompare(b.slug));
        break;
      case 'date':
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        break;
      case 'pf':
      default:
        list.sort((a, b) => b.pf - a.pf);
        break;
    }
    return list;
  }, [studies, filters, eventFilter]);

  const strategies = useMemo(() => filtered.filter((s) => s.kind === 'strategy'), [filtered]);
  const marketStudies = useMemo(() => filtered.filter((s) => s.kind === 'study'), [filtered]);

  const bestStrategyPf = useMemo(
    () => (strategies.length > 0 ? Math.max(...strategies.map((s) => s.pf)) : 0),
    [strategies],
  );

  const sections = useMemo(() => {
    const result: { key: string; label: string; subtitle: string; items: typeof filtered }[] = [];
    if (strategies.length > 0) {
      result.push({
        key: 'strategy',
        label: 'Strategies',
        subtitle: `${strategies.length} ${strategies.length === 1 ? 'study' : 'studies'}${bestStrategyPf > 0 ? ` · best PF ${bestStrategyPf.toFixed(2)}` : ''}`,
        items: strategies,
      });
    }
    if (marketStudies.length > 0) {
      result.push({
        key: 'study',
        label: 'Market studies',
        subtitle: `${marketStudies.length} ${marketStudies.length === 1 ? 'study' : 'studies'} · descriptive`,
        items: marketStudies,
      });
    }
    return result;
  }, [strategies, marketStudies, bestStrategyPf]);

  // suppress unused warning — weekly/selectedDow kept for future day-playbook integration
  void weekly;
  void selectedDow;

  return (
    <>
      <HubTopBar
        asset={filters.asset}
        sortBy={filters.sortBy}
        query={filters.query}
        family={filters.family}
        onAsset={(a) => updateFilter('asset', a)}
        onSort={(s) => updateFilter('sortBy', s)}
        onQuery={(q) => updateFilter('query', q)}
        onClearFamily={clearFamily}
      />

      <main className="bd-hub-main" id="hub-grid">
        {sections.length === 0 ? (
          <p className="bd-hub-empty">No studies match your filters.</p>
        ) : (
          sections.map(({ key, label, subtitle, items }) => {
            const grouped = groupItems(items);
            const searchActive = filters.query.trim() !== '';
            const groupCount = grouped.length;
            const defaultOpen = searchActive || groupCount <= 3;
            return (
              <section key={key} className="bd-kind-section">
                <div className="bd-kind-head">
                  <h2 className="bd-kind-title">{label}</h2>
                  <p className="bd-kind-subtitle">{subtitle}</p>
                </div>
                <div className="bd-hub-index">
                  {grouped.map((g) => (
                    <details
                      key={g.key}
                      className="bd-evt"
                      open={defaultOpen || undefined}
                    >
                      <summary className="bd-evt-head">
                        <span className="bd-evt-name">{g.label}</span>
                        <span className="bd-evt-meta">
                          <span className="bd-evt-count">{g.items.length} {g.items.length === 1 ? 'variant' : 'variants'}</span>
                          {g.bestPf > 0 && (
                            <>
                              <span className="bd-evt-count"> · best PF </span>
                              <span className="bd-evt-pf">{g.bestPf.toFixed(2)}</span>
                            </>
                          )}
                        </span>
                        <span className="bd-evt-chevron" aria-hidden="true">›</span>
                      </summary>
                      <div className="bd-evt-body">
                        {g.items.map((s) => (
                          <StudyRow key={s.slug} s={s} />
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>
    </>
  );
}
