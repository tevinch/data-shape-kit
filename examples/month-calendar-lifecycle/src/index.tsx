import React, { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import FullCalendar, { formatDate, type EventApi, type EventDisplayInfo } from '@fullcalendar/react';
import themePlugin from '@fullcalendar/react/themes/classic';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import './style.css';

const plugins = [themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin];
const initialEvents = [
  { id: '0', title: 'All-day event', start: '2026-10-14' },
  { id: '1', title: 'Timed event', start: '2026-10-14T12:00:00' },
];
const checks = { reactVersion: React.version, development: process.env.NODE_ENV === 'development', mounts: 0, cleanups: 0, drop: 0, resize: 0, dragStart: 0, dragStop: 0, allow: 0, select: 0, added: 0, deleted: 0, allowance: [] as any[], getState: () => ({}), printBefore: 0, printAfter: 0, printRows: [] as any[] };
(window as any).monthCalendar = checks;
let nextId = 2;

function MountedCalendar({ children }: { children: React.ReactNode }) {
  useEffect(() => { checks.mounts += 1; return () => { checks.cleanups += 1; }; }, []);
  return children;
}

function App() {
  const calendarRef = useRef<any>(null);
  const [events, setEvents] = useState<EventApi[]>([]);
  const [weekends, setWeekends] = useState(true);
  const [editable, setEditable] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [compact, setCompact] = useState(false);
  const [visible, setVisible] = useState(true);
  const allow = useCallback((info: any) => { checks.allow += 1; const accepted = !restricted || info.startStr.slice(0, 10) !== '2026-10-20'; checks.allowance.push({ start: info.startStr, accepted, restricted }); return accepted; }, [restricted]);
  const onSelect = useCallback((info: any) => {
    checks.select += 1;
    const title = prompt('Please enter a new title for your event');
    info.view.calendar.unselect();
    if (title) { info.view.calendar.addEvent({ id: String(nextId++), title, start: info.startStr, end: info.endStr, allDay: info.allDay }); checks.added += 1; }
  }, []);
  const onClick = useCallback((info: any) => { if (confirm(`Are you sure you want to delete the event '${info.event.title}'`)) { info.event.remove(); checks.deleted += 1; } }, []);
  const crowdedDay = () => { const api = calendarRef.current?.getApi(); if (!api) return; if (api.getEventById('sample-0')) { api.getEvents().filter((e: EventApi) => e.id.startsWith('sample-')).forEach((e: EventApi) => e.remove()); } else { for (let i = 0; i < 14; i++) api.addEvent({ id: `sample-${i}`, title: `Busy day ${i + 1}`, start: '2026-10-21', allDay: true }); } };
  const printPreview = () => { const api=calendarRef.current?.getApi(); api?.trigger('_beforeprint'); checks.printBefore++; checks.printRows=[...document.querySelectorAll('#calendar-panel [role=row]')].filter(e=>e.querySelector('[data-date][role=cell]')).map(e=>({ height:e.getBoundingClientRect().height, visibleEvents:[...e.querySelectorAll('[role=button]')].filter(v=>getComputedStyle(v).visibility!=='hidden').length })); };
  const screenPreview = () => { calendarRef.current?.getApi().trigger('_afterprint'); checks.printAfter++; };
  const onEvents = useCallback((list: EventApi[]) => setEvents(list), []);
  checks.getState = () => {
    const api = calendarRef.current?.getApi();
    return { events: api?.getEvents().map((e: EventApi) => ({ id: e.id, title: e.title, start: e.startStr, end: e.endStr, allDay: e.allDay, extendedProps: e.extendedProps })).sort((a: any, b: any) => a.id.localeCompare(b.id)), options: { editable: api?.getOption('editable'), weekends: api?.getOption('weekends'), allowCurrent: api?.getOption('eventAllow') === allow }, allowance: checks.allowance, counters: { drop: checks.drop, resize: checks.resize, dragStart: checks.dragStart, dragStop: checks.dragStop, allow: checks.allow, select: checks.select, added: checks.added, deleted: checks.deleted }, mounts: checks.mounts, cleanups: checks.cleanups, view: api?.view.type, date: api?.getDate().toISOString(), month: api?.getDate().getMonth() + 1, editable, restricted, weekends, compact, visible, printBefore: checks.printBefore, printAfter: checks.printAfter, printRows: checks.printRows };
  };
  return <main>
    <aside>
      <h1>Month calendar</h1>
      <p>Drag, resize, select dates to add an event, or click an event to delete it.</p>
      <label><input id="weekends" type="checkbox" checked={weekends} onChange={e => setWeekends(e.target.checked)} /> Show weekends</label>
      <label><input id="editable" type="checkbox" checked={editable} onChange={e => setEditable(e.target.checked)} /> Allow changes</label>
      <label><input id="restricted" type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} /> Block moves to October 20</label>
      <label><input id="compact" type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} /> Narrow calendar</label>
      <button id="toggle-calendar" onClick={() => setVisible(v => !v)}>{visible ? 'Unmount calendar' : 'Mount calendar'}</button>
      <button id="crowded-day" onClick={crowdedDay}>Add or remove crowded-day sample</button>
      <button id="print-preview" onClick={printPreview}>Print layout</button>
      <button id="screen-preview" onClick={screenPreview}>Screen layout</button>
      <h2>All Events ({events.length})</h2>
      <ul id="event-list">{events.map(event => <li key={event.id} data-event-id={event.id}><b>{formatDate(event.start!, { year: 'numeric', month: 'short', day: 'numeric' })}</b><i>{event.title}</i></li>)}</ul>
    </aside>
    <section id="calendar-panel" style={{ width: compact ? 660 : 1050 }}>
      {visible && <MountedCalendar><FullCalendar
        ref={calendarRef}
        plugins={plugins}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
        now="2026-10-14"
        initialDate="2026-10-14"
        initialView="dayGridMonth"
        initialEvents={initialEvents}
        editable={editable}
        eventAllow={allow}
        selectable
        selectMirror
        dayMaxEvents
        weekends={weekends}
        select={onSelect}
        eventClick={onClick}
        eventsSet={onEvents}
        eventDragStart={() => { checks.dragStart += 1; }}
        eventDragStop={() => { checks.dragStop += 1; }}
        eventDrop={() => { checks.drop += 1; }}
        eventResize={() => { checks.resize += 1; }}
        eventClass={info => `event-${info.event.id}`}
        eventContent={renderEvent}
      /></MountedCalendar>}
    </section>
  </main>;
}
function renderEvent(info: EventDisplayInfo) { return <><b>{info.timeText}</b><i>{info.event.title}</i></>; }
const app = <App />;
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('plain') ? app : <StrictMode>{app}</StrictMode>);
