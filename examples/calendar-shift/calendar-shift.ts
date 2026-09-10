import { Temporal } from '@js-temporal/polyfill';

export type CalendarUnit = 'day' | 'week' | 'month' | 'year';

export type ShiftOptions = {
  disambiguation?: 'reject' | 'earlier' | 'later' | 'compatible';
  overflow?: 'constrain' | 'reject';
};

const calendarUnits: readonly CalendarUnit[] = ['day', 'week', 'month', 'year'];
const disambiguations = ['reject', 'earlier', 'later', 'compatible'] as const;
const overflows = ['constrain', 'reject'] as const;

function assertSafeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number`);
  }
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a finite safe integer`);
  }
}

function assertCalendarUnit(value: unknown): asserts value is CalendarUnit {
  if (!calendarUnits.includes(value as CalendarUnit)) {
    throw new RangeError(`unit must be one of: ${calendarUnits.join(', ')}`);
  }
}

function readOptions(options: ShiftOptions | undefined): Required<ShiftOptions> {
  if (
    options !== undefined &&
    (typeof options !== 'object' || options === null || Array.isArray(options))
  ) {
    throw new TypeError('options must be an object when provided');
  }

  if (options !== undefined) {
    for (const key of Reflect.ownKeys(options)) {
      if (key !== 'disambiguation' && key !== 'overflow') {
        throw new RangeError(`unknown option: ${String(key)}`);
      }
    }
  }

  const disambiguation = options?.disambiguation ?? 'reject';
  if (!disambiguations.includes(disambiguation)) {
    throw new RangeError(
      `disambiguation must be one of: ${disambiguations.join(', ')}`,
    );
  }

  const overflow = options?.overflow ?? 'constrain';
  if (!overflows.includes(overflow)) {
    throw new RangeError(`overflow must be one of: ${overflows.join(', ')}`);
  }

  return { disambiguation, overflow };
}

export function shiftCalendar(
  epochMilliseconds: number,
  amount: number,
  unit: CalendarUnit,
  timeZone: string,
  options?: ShiftOptions,
): number {
  assertSafeInteger(epochMilliseconds, 'epochMilliseconds');
  assertSafeInteger(amount, 'amount');
  assertCalendarUnit(unit);
  if (typeof timeZone !== 'string' || timeZone.trim() === '') {
    throw new TypeError('timeZone must be a nonempty string');
  }
  const { disambiguation, overflow } = readOptions(options);

  const zoned = Temporal.Instant.fromEpochMilliseconds(
    epochMilliseconds,
  ).toZonedDateTimeISO(timeZone);

  if (amount === 0) return epochMilliseconds;

  const duration =
    unit === 'day'
      ? { days: amount }
      : unit === 'week'
        ? { weeks: amount }
        : unit === 'month'
          ? { months: amount }
          : { years: amount };
  const shiftedWallTime = zoned.toPlainDateTime().add(duration, { overflow });
  const shifted = shiftedWallTime.toZonedDateTime(timeZone, {
    disambiguation,
  });

  return shifted.epochMilliseconds;
}
