import type { EventStudyStats } from './strategy-stats';

export type NewsCalendarItem = {
  date: string;     // YYYY-MM-DD
  day: string;      // "Wed 20"
  time: string;     // "8:30" / "14:00" (ET)
  event: string;
  imp: string;      // "High" | "Medium" | "Low"
  weekday: number;  // 0=Mon .. 6=Sun
};

export type CalendarView = 'this' | 'next' | 'month';

export type DayBucket = {
  dayKey: string;       // 'mon' | 'tue' | ... or 'YYYY-MM-DD' for month grid
  label: string;        // 'Mon' / 'Tue' / number for month
  date: string;         // 'May 21'
  iso: string;          // 'YYYY-MM-DD'
  isToday: boolean;
  events: Array<{
    time: string;
    event: string;
    imp: string;
    study: EventStudyStats | null;
  }>;
};

// Get ET "today" as YYYY-MM-DD (rough offset; OK for grouping purposes).
function todayET(): Date {
  const nowUtc = new Date();
  const etMs = nowUtc.getTime() - 5 * 60 * 60 * 1000;
  return new Date(etMs);
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shortDate(d: Date): string {
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${d.getUTCDate()}`;
}

// Mon-Fri dates for the week containing `anchor` (or next Mon if weekend).
export function getWeekDatesFor(anchor: Date): Date[] {
  const dow = anchor.getUTCDay(); // 0=Sun, 6=Sat
  const daysFromMon =
    dow === 0 ? 1
    : dow === 6 ? 2
    : 1 - dow;
  const monday = new Date(anchor.getTime() + daysFromMon * 86400000);
  return Array.from({ length: 5 }, (_, i) => new Date(monday.getTime() + i * 86400000));
}

// Generate Mon-Fri buckets for this/next week, filtering events from a calendar feed.
export function buildWeekBuckets(
  events: NewsCalendarItem[],
  weekOffset: number, // 0 = this week, 1 = next week
  studyMap: Record<string, EventStudyStats | null>
): DayBucket[] {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const today = todayET();
  const todayIso = isoDate(today);

  const baseAnchor = new Date(today.getTime() + weekOffset * 7 * 86400000);
  const weekDates = getWeekDatesFor(baseAnchor);

  return weekDates.map((d, i) => {
    const iso = isoDate(d);
    const dayEvents = events
      .filter((e) => e.date === iso)
      .map((e) => ({
        time: e.time,
        event: e.event,
        imp: e.imp,
        study: studyMap[e.event] ?? null,
      }));
    return {
      dayKey: DAY_LABELS[i].toLowerCase(),
      label: DAY_LABELS[i],
      date: shortDate(d),
      iso,
      isToday: iso === todayIso,
      events: dayEvents,
    };
  });
}

// Generate full-month grid (6 rows × 7 cols) for the current ET month.
export function buildMonthBuckets(
  events: NewsCalendarItem[],
  studyMap: Record<string, EventStudyStats | null>
): { weeks: DayBucket[][]; monthLabel: string } {
  const today = todayET();
  const todayIso = isoDate(today);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  const first = new Date(Date.UTC(year, month, 1));
  // Grid starts on Monday: dow Mon=1..Sun=0 → offset
  const dow = first.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const gridStart = new Date(first.getTime() + mondayOffset * 86400000);

  const weeks: DayBucket[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: DayBucket[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart.getTime() + (w * 7 + i) * 86400000);
      const iso = isoDate(d);
      const dayEvents = events
        .filter((e) => e.date === iso)
        .map((e) => ({
          time: e.time,
          event: e.event,
          imp: e.imp,
          study: studyMap[e.event] ?? null,
        }));
      row.push({
        dayKey: iso,
        label: String(d.getUTCDate()),
        date: shortDate(d),
        iso,
        isToday: iso === todayIso,
        events: dayEvents,
      });
    }
    weeks.push(row);
  }

  const monthLabel = first.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { weeks, monthLabel };
}

// Window-aware event list for the bottom "News calendar" section.
// Includes both High and Medium impact events from the whitelist.
export function getRedFolderForView(
  events: NewsCalendarItem[],
  view: CalendarView,
  whitelist: Set<string>
): NewsCalendarItem[] {
  const isTracked = (e: NewsCalendarItem) =>
    (e.imp === 'High' || e.imp === 'Medium') && whitelist.has(e.event);
  const today = todayET();
  if (view === 'month') {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    return events.filter((e) => {
      const d = new Date(e.date + 'T00:00:00Z');
      return d.getUTCFullYear() === y && d.getUTCMonth() === m && isTracked(e);
    });
  }
  const offset = view === 'next' ? 1 : 0;
  const anchor = new Date(today.getTime() + offset * 7 * 86400000);
  const week = getWeekDatesFor(anchor).map(isoDate);
  const set = new Set(week);
  return events.filter((e) => set.has(e.date) && isTracked(e));
}
