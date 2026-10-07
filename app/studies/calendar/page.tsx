import { loadNewsCalendar } from '@/lib/news-calendar-server';
import { getEventStudyMap } from '@/lib/strategy-stats';
import CalendarView from './_components/CalendarView';

export default function CalendarPage() {
  // Server-side: load multi-week calendar (prev week → +4 weeks).
  const events = loadNewsCalendar();
  const studyMapNq = getEventStudyMap(events, 'nq');
  const studyMapGc = getEventStudyMap(events, 'gc');

  return (
    <>
      <div className="v3-hero-crumb">Calendar</div>
      <CalendarView
        events={events}
        studyMapByAsset={{ nq: studyMapNq, gc: studyMapGc }}
      />
    </>
  );
}
