'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsset } from '../../_components/AssetContext';
import {
  buildMonthBuckets,
  buildWeekBuckets,
  getRedFolderForView,
  type CalendarView,
  type DayBucket,
  type NewsCalendarItem,
} from '@/lib/news-calendar';
import { RED_FOLDER_WHITELIST } from '@/lib/news-week';
import { MARKET_HOLIDAYS, MARKET_EARLY_CLOSE } from '@/lib/market-holidays';
import type { EventStudyStats } from '@/lib/strategy-stats';

type StudyMap = Record<string, EventStudyStats | null>;

type Props = {
  events: NewsCalendarItem[];
  studyMapByAsset: { nq: StudyMap; gc: StudyMap };
};

function impClass(imp: string): string {
  if (imp === 'High') return 'v3-imp-h';
  if (imp === 'Medium') return 'v3-imp-m';
  return '';
}

function DayCard({
  day,
  asset,
  href,
}: {
  day: DayBucket;
  asset: string;
  href: string | null;
}) {
  const filtered = day.events.filter((e) => e.study != null);
  const holiday = MARKET_HOLIDAYS[day.iso];
  const earlyClose = MARKET_EARLY_CLOSE[day.iso];

  const cardClass = 'v3-day-card' + (day.isToday ? ' today' : '');
  const inner = (
    <>
      <div className="v3-day-hd">
        <div className="v3-day-name-wrap">
          <span className="v3-day-name">{day.label}</span>
          {day.isToday && <span className="v3-today-badge">Today</span>}
        </div>
        <span className="v3-day-date">{day.date}</span>
      </div>
      {holiday && (
        <div className="v3-day-holiday">Market closed · {holiday}</div>
      )}
      {earlyClose && !holiday && (
        <div className="v3-day-holiday v3-day-earlyclose">Early close 1pm ET · {earlyClose}</div>
      )}
      {filtered.length === 0 && !holiday ? (
        <div className="v3-day-empty">Quiet day — no red folder release</div>
      ) : (
        filtered.map((ev, i) => (
          <div key={i} className="v3-day-strat">
            <div className="v3-day-strat-name">
              {ev.event}
              <span className="v3-day-strat-time"> · {ev.time}</span>
            </div>
            {ev.study ? (
              <div className="v3-day-strat-stats">
                <span>N={ev.study.n}</span>
                <span>
                  WR <span className="pos">{ev.study.wr}%</span>
                </span>
                <span className="pos">+{ev.study.net} pts</span>
              </div>
            ) : (
              <div
                className="v3-day-empty"
                style={{ padding: '4px 0', fontStyle: 'italic' }}
              >
                No backtest yet
              </div>
            )}
          </div>
        ))
      )}
    </>
  );

  return href ? (
    <Link href={href} className={cardClass}>
      {inner}
    </Link>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}

function MonthCell({ day, asset }: { day: DayBucket; asset: string }) {
  const filtered = day.events.filter((e) => e.study != null);
  const inMonth = day.iso.slice(0, 7) === new Date().toISOString().slice(0, 7);

  const cls =
    'v3-month-cell' +
    (day.isToday ? ' today' : '') +
    (inMonth ? '' : ' faded');

  return (
    <div className={cls}>
      <div className="v3-month-cell-d">{day.label}</div>
      {filtered.slice(0, 2).map((ev, i) => {
        const tag = ev.study ? (
          <Link
            key={i}
            href={`/studies/${ev.study.slug}/`}
            className={'v3-month-ev v3-month-ev-link ' + impClass(ev.imp)}
            title={`${ev.time} · ${ev.event}`}
          >
            {ev.event}
          </Link>
        ) : (
          <span
            key={i}
            className={'v3-month-ev ' + impClass(ev.imp)}
            title={`${ev.time} · ${ev.event}`}
          >
            {ev.event}
          </span>
        );
        return tag;
      })}
      {filtered.length > 2 && (
        <span className="v3-month-more">+{filtered.length - 2}</span>
      )}
    </div>
  );
}

export default function CalendarViewComponent({ events, studyMapByAsset }: Props) {
  const { asset } = useAsset();
  const [view, setView] = useState<CalendarView>('this');

  // 'all' falls back to NQ map (NQ covers the canonical event set).
  const studyMap = asset === 'gc' ? studyMapByAsset.gc : studyMapByAsset.nq;

  const weekBuckets = useMemo(() => {
    if (view === 'this') return buildWeekBuckets(events, 0, studyMap);
    if (view === 'next') return buildWeekBuckets(events, 1, studyMap);
    return [];
  }, [events, studyMap, view]);

  const month = useMemo(
    () => (view === 'month' ? buildMonthBuckets(events, studyMap) : null),
    [events, studyMap, view],
  );

  const redFolder = useMemo(() => {
    const base = getRedFolderForView(events, view, RED_FOLDER_WHITELIST);
    return base.filter((e) => studyMap[e.event] != null);
  }, [events, view, studyMap]);

  const subhead =
    view === 'this' ? 'This week' : view === 'next' ? 'Next week' : 'Month view';
  const redLabel =
    view === 'this'
      ? 'News calendar — this week'
      : view === 'next'
      ? 'News calendar — next week'
      : 'News calendar — this month';

  return (
    <>
      <h1 className="v3-hero-h1">
        {subhead}
        <span className="v3-hero-dot">.</span>
      </h1>
      <p className="v3-hero-sub">
        Top strategies firing each day · click a card to drill down.
      </p>

      <div className="v3-filters">
        <button
          type="button"
          className={'v3-flt-pill' + (view === 'this' ? ' active' : '')}
          onClick={() => setView('this')}
        >
          This week
        </button>
        <button
          type="button"
          className={'v3-flt-pill' + (view === 'next' ? ' active' : '')}
          onClick={() => setView('next')}
        >
          Next week
        </button>
        <button
          type="button"
          className={'v3-flt-pill' + (view === 'month' ? ' active' : '')}
          onClick={() => setView('month')}
        >
          Month view
        </button>
      </div>

      {view !== 'month' ? (
        <div className="v3-day-cards">
          {weekBuckets.map((day) => {
            const firstStudy = day.events.find((e) => e.study != null)?.study ?? null;
            const href = firstStudy ? `/studies/${firstStudy.slug}/` : null;
            return <DayCard key={day.iso} day={day} asset={asset} href={href} />;
          })}
        </div>
      ) : (
        <div className="v3-month-wrap">
          <div className="v3-month-title">{month?.monthLabel}</div>
          <div className="v3-month-grid">
            <div className="v3-month-hd">Mon</div>
            <div className="v3-month-hd">Tue</div>
            <div className="v3-month-hd">Wed</div>
            <div className="v3-month-hd">Thu</div>
            <div className="v3-month-hd">Fri</div>
            <div className="v3-month-hd">Sat</div>
            <div className="v3-month-hd">Sun</div>
            {month?.weeks.flat().map((d) => (
              <MonthCell key={d.iso} day={d} asset={asset} />
            ))}
          </div>
        </div>
      )}

      <section className="v3-news-week">
        <div className="v3-news-week-h2">{redLabel}</div>
        <div className="v3-news-week-sub">
          Scheduled tracked releases (NY time). High = backtested edge · Med = lower expected move.
        </div>
        {redFolder.length === 0 ? (
          <p className="v3-news-empty">
            No red-folder events scheduled. Quiet macro window.
          </p>
        ) : (
          <ul className="v3-news-list">
            {redFolder.map((row, i) => {
              const slug = studyMap[row.event]?.slug ?? null;
              const inner = (
                <>
                  <span className="v3-news-td-d">{row.day}</span>
                  <span className="v3-news-td-t">{row.time}</span>
                  <span className="v3-news-td-e">{row.event}</span>
                  <span className={'v3-news-td-imp ' + impClass(row.imp)}>
                    {row.imp === 'Medium' ? 'Med' : row.imp}
                  </span>
                </>
              );
              return (
                <li key={i}>
                  {slug ? (
                    <Link
                      href={`/studies/${slug}/`}
                      className="v3-news-row v3-news-row-link"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="v3-news-row">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
