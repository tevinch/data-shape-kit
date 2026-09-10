import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

import {
  shiftCalendar,
  type CalendarUnit,
  type ShiftOptions,
} from '../calendar-shift.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const zone = 'America/New_York';
const source = dayjs.utc('2024-03-09T07:30:00.123Z').tz(zone);
const unit: CalendarUnit = 'day';
const options: ShiftOptions = {
  disambiguation: 'later',
  overflow: 'constrain',
};
const result: number = shiftCalendar(source.valueOf(), 1, unit, zone, options);
const displayed: string = dayjs.utc(result).tz(zone).format('YYYY-MM-DD HH:mm:ss.SSS Z');

// @ts-expect-error Hours are elapsed-time units, outside the calendar contract.
shiftCalendar(source.valueOf(), 1, 'hour', zone);

// @ts-expect-error Disambiguation is a closed union.
shiftCalendar(source.valueOf(), 1, 'day', zone, { disambiguation: 'middle' });

// @ts-expect-error Overflow is a closed union.
shiftCalendar(source.valueOf(), 1, 'month', zone, { overflow: 'balance' });

void displayed;
