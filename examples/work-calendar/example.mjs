import { tz } from '@date-fns/tz';
import { addBusinessDays, format } from 'date-fns';

import { createWorkCalendar } from './dist/work-calendar.js';

const Shanghai = tz('Asia/Shanghai');
const instant = new Date('2026-01-01T12:00:00+08:00');
const day = format(instant, 'yyyy-MM-dd', { in: Shanghai });
const nativeResult = format(addBusinessDays(instant, 1, { in: Shanghai }), 'yyyy-MM-dd', {
  in: Shanghai,
});
const customResult = createWorkCalendar({ holidays: ['2026-01-02'] }).addWorkdays(day, 1);

console.log(`Calendar date in Asia/Shanghai: ${day}`);
console.log(`date-fns addBusinessDays result: ${nativeResult}`);
console.log(`Holiday-aware work calendar result: ${customResult}`);
