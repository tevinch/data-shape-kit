import assert from 'node:assert/strict';

import { tz } from '@date-fns/tz';
import { addBusinessDays, format } from 'date-fns';

import { createWorkCalendar } from '../dist/work-calendar.js';

const Shanghai = tz('Asia/Shanghai');
const instant = new Date('2026-01-01T12:00:00+08:00');
const day = format(instant, 'yyyy-MM-dd', { in: Shanghai });
const native = format(addBusinessDays(instant, 1, { in: Shanghai }), 'yyyy-MM-dd', {
  in: Shanghai,
});
const custom = createWorkCalendar({ holidays: ['2026-01-02'] }).addWorkdays(day, 1);

const result = { custom, day, native };
assert.deepEqual(result, {
  custom: '2026-01-05',
  day: '2026-01-01',
  native: '2026-01-02',
});
process.stdout.write(`${JSON.stringify(result)}\n`);
