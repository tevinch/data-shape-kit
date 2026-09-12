import { Calendar } from 'fullcalendar';
import timeGrid from 'fullcalendar/timegrid';
import classic from 'fullcalendar/themes/classic';
import resourceTimeGrid from 'fullcalendar-scheduler/resource-timegrid';
import scrollGrid from 'fullcalendar-scheduler/scrollgrid';
import 'fullcalendar/skeleton.css';
import 'fullcalendar/themes/classic/theme.css';
import 'fullcalendar/themes/classic/palette.css';

const search = new URLSearchParams(window.location.search);
const resourceMode = search.get('resource') === '1';
const originalMode = search.get('original') === '1';
const calendarEl = document.querySelector('#calendar');

const formatSlotTime = (date) =>
  `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;

const calendar = new Calendar(calendarEl, {
  plugins: [timeGrid, resourceTimeGrid, scrollGrid, classic],
  initialView: resourceMode ? 'resourceTimeGridDay' : 'timeGridDay',
  initialDate: '2026-09-12',
  timeZone: 'UTC',
  slotDuration: '00:15',
  slotHeaderInterval: originalMode ? undefined : '00:15',
  slotMinTime: '05:45',
  slotMaxTime: '22:00',
  slotMinHeight: 40,
  allDaySlot: false,
  dayMinWidth: 200,
  expandRows: false,
  height: 800,
  resources: [{ id: 'one', title: 'Room one' }],
  events: [{ id: 'booking', resourceId: 'one', title: 'Example booking', start: '2026-09-12T10:00:00Z', end: '2026-09-12T11:00:00Z' }],
  slotHeaderDidMount(info) {
    info.el.dataset.slotTime = formatSlotTime(info.date);
  },
  eventClass: 'calendar-booking',
});

calendar.render();
window.calendar = calendar;
window.calendarExample = { originalMode, resourceMode };

document.querySelector('#mode-note').textContent = originalMode
  ? 'Original configuration reproduction'
  : resourceMode
    ? 'Resource view evaluation'
    : 'Standard view';

document.querySelector('#apply-hours').addEventListener('click', () => {
  calendar.batchRendering(() => {
    calendar.setOption('slotMinTime', document.querySelector('#opening-time').value);
    calendar.setOption('slotMaxTime', document.querySelector('#closing-time').value);
  });
});
