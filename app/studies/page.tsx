import Link from 'next/link';
import { Suspense } from 'react';
import { getAllStudyStats, getDistinctEventCount } from '@/lib/study-stats';
import { getWeeklyPlaybook } from '@/lib/today-events';
import { eventKeyOf } from '@/lib/event-key';
import { eventFull } from '@/lib/terminology';
import HubFilters from './_components/HubFilters';
import BasicsBanner from './_components/BasicsBanner';

export const metadata = {
  title: 'Studies — 10 years of futures data, backtested · JackTradesNQ',
  description:
    'Every NQ, ES, GC and SI futures setup backtested on 10 years of 1-minute bars. Profit factor, win rate and event stats — numbers first.',
};

export default function BacktestedHub() {
  const studies = getAllStudyStats();
  const weekly = getWeeklyPlaybook(studies);

  const totalTrades = studies.reduce((s, st) => s + st.n, 0);
  const assets = [...new Set(studies.map((s) => s.asset))].length;
  const count = studies.length;
  const eventCount = getDistinctEventCount(studies);

  // Strongest edges: best honest strategy per event (n ≥ 10, real PF), top 3 by PF.
  const topEdges = (() => {
    const byEvent = new Map<string, (typeof studies)[number]>();
    for (const s of studies) {
      if (s.kind !== 'strategy' || s.n < 10 || s.pf <= 0 || s.pf >= 99) continue;
      const k = eventKeyOf(s.slug) ?? s.slug;
      const cur = byEvent.get(k);
      if (!cur || s.pf > cur.pf) byEvent.set(k, s);
    }
    return [...byEvent.values()].sort((a, b) => b.pf - a.pf).slice(0, 3);
  })();

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bd-hub-center">
      <BasicsBanner />
      <header className="bd-hub-head">
        <div className="bd-hub-crumb">Atlas · Updated {today}</div>
        <h1 className="bd-h1">
          The data<span className="bd-dot">.</span>
        </h1>
        <p className="bd-hub-sub">
          Every futures setup, backtested on 10 years of 1-minute bars.
          Numbers first — methodology underneath. Re-verify before risking capital.
        </p>
        <p className="bd-hub-legend">
          PF = profit factor ($ won per $1 lost). New to the terms?{' '}
          <a href="/studies/basics/">See the Basics.</a>
        </p>
        <div className="bd-hub-meta">
          <div className="bd-hub-meta-item">
            <b className="bd-hub-meta-num">{eventCount}</b>
            <i className="bd-hub-meta-lbl">studies</i>
          </div>
          <div className="bd-hub-meta-item">
            <b className="bd-hub-meta-num">{count}</b>
            <i className="bd-hub-meta-lbl">variants tested</i>
          </div>
          <div className="bd-hub-meta-item">
            <b className="bd-hub-meta-num">10y</b>
            <i className="bd-hub-meta-lbl">NQ · GC · ES · SI</i>
          </div>
          <div className="bd-hub-meta-item">
            <b className="bd-hub-meta-num">{assets}</b>
            <i className="bd-hub-meta-lbl">assets</i>
          </div>
        </div>
      </header>

      {topEdges.length > 0 && (
        <section className="idx-top" aria-label="Strongest edges">
          <h2 className="idx-top-h">Strongest edges</h2>
          <div className="idx-top-grid">
            {topEdges.map((s) => {
              const label = eventFull(eventKeyOf(s.slug) ?? s.slug);
              return (
                <Link key={s.slug} href={s.href ?? `/studies/${s.slug}/`} className="idx-edge">
                  <div className="idx-edge-row">
                    <span className="idx-edge-ev">{label}</span>
                    <span className="idx-edge-asset">{s.asset}</span>
                  </div>
                  <div className="idx-edge-pf">
                    <span className="idx-edge-pf-val">{s.pf.toFixed(2)}</span>
                    <span className="idx-edge-pf-lbl">profit factor</span>
                  </div>
                  <div className="idx-edge-foot">{s.wr}% win rate · {s.n} events</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <Suspense fallback={null}>
        <HubFilters studies={studies} weekly={weekly} />
      </Suspense>
    </div>
  );
}
