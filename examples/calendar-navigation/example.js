import { Calendar } from 'fullcalendar';
import dayGrid from 'fullcalendar/daygrid';
import classic from 'fullcalendar/themes/classic';
import esLocale from 'fullcalendar/locales/es';
import 'fullcalendar/skeleton.css';
import 'fullcalendar/themes/classic/theme.css';
import 'fullcalendar/themes/classic/palette.css';

const originalMode = new URLSearchParams(location.search).has('original');

window.calendar = new Calendar(document.querySelector('#calendar'), {
  plugins: [dayGrid, classic],
  locales: [esLocale],
  locale: 'es',
  ...(originalMode ? {} : {
    todayHint: 'Ir a hoy',
    prevHint: 'Periodo anterior',
    nextHint: 'Periodo siguiente',
  }),
  initialDate: '2024-07-15',
  now: '2026-09-13',
  timeZone: 'UTC',
  views: { dayGridYear: { type: 'dayGrid', duration: { month: 12 } } },
  initialView: 'dayGridYear',
  headerToolbar: { left: 'prev,today,next', center: 'title', right: 'dayGridMonth,dayGridYear' },
  buttons: { dayGridYear: { text: '12 meses' } },
  datesSet(info) {
    document.querySelector('#period').textContent = `${info.view.currentStart.toISOString().slice(0, 10)} → ${info.view.currentEnd.toISOString().slice(0, 10)} (fin no incluido)`;
  },
  events: [{ id: 'meeting', title: 'Reunión de ejemplo', start: '2024-07-16', extendedProps: { reference: 'unchanged' } }],
});
window.calendar.render();
window.renderFinished = true;
document.querySelector('#mode').textContent = originalMode ? 'Configuración original' : 'Indicaciones de navegación configuradas';
