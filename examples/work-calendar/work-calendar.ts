export interface WorkCalendarOptions {
  workingWeekdays?: readonly number[];
  holidays?: readonly string[];
}

export interface WorkCalendar {
  readonly isWorkday: (day: string) => boolean;
  readonly isHoliday: (day: string) => boolean;
  readonly addWorkdays: (day: string, amount: number) => string;
  readonly countWorkdays: (start: string, end: string) => number;
}

const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5] as const;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const MAX_ORDINAL = daysBeforeYear(MAX_YEAR + 1) - 1;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;
const ALLOWED_OPTION_KEYS = new Set(['workingWeekdays', 'holidays']);

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysBeforeYear(year: number): number {
  const previous = year - 1;
  return (
    previous * 365 +
    Math.floor(previous / 4) -
    Math.floor(previous / 100) +
    Math.floor(previous / 400)
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function parseDay(day: unknown): number {
  if (typeof day !== 'string') {
    throw new TypeError('day must be a string');
  }

  const match = DAY_PATTERN.exec(day);
  if (match === null) {
    throw new RangeError('day must be an exact YYYY-MM-DD date');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    month < 1 ||
    month > 12 ||
    date < 1 ||
    date > daysInMonth(year, month)
  ) {
    throw new RangeError('day is outside the supported Gregorian date range');
  }

  const leapAdjustment = isLeapYear(year) && month > 2 ? 1 : 0;
  return daysBeforeYear(year) + MONTH_STARTS[month - 1] + leapAdjustment + date - 1;
}

function formatDay(ordinal: number): string {
  let low = MIN_YEAR;
  let high = MAX_YEAR;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (daysBeforeYear(middle) <= ordinal) low = middle;
    else high = middle - 1;
  }

  const year = low;
  let remaining = ordinal - daysBeforeYear(year);
  let month = 1;
  while (remaining >= daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month += 1;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    remaining + 1,
  ).padStart(2, '0')}`;
}

function weekday(ordinal: number): number {
  return (ordinal + 1) % 7;
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function requireDenseArray(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      throw new TypeError(`${name} must be dense`);
    }
  }
  return value;
}

function readOptions(options: WorkCalendarOptions | undefined): {
  holidays: string[];
  weekdays: boolean[];
} {
  if (options !== undefined) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('options must be a plain object');
    }
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('options must be a plain object');
    }
    for (const key of Reflect.ownKeys(options)) {
      if (typeof key !== 'string' || !ALLOWED_OPTION_KEYS.has(key)) {
        throw new TypeError('options contains an unknown key');
      }
    }
  }

  const weekdayValues =
    options?.workingWeekdays === undefined
      ? DEFAULT_WORKING_WEEKDAYS
      : requireDenseArray(options.workingWeekdays, 'workingWeekdays');
  const weekdays = Array<boolean>(7).fill(false);
  for (const value of weekdayValues) {
    if (typeof value !== 'number') {
      throw new TypeError('workingWeekdays entries must be numbers');
    }
    if (!Number.isInteger(value) || value < 0 || value > 6) {
      throw new RangeError('workingWeekdays entries must be integers from 0 through 6');
    }
    weekdays[value] = true;
  }
  if (!weekdays.some(Boolean)) {
    throw new RangeError('workingWeekdays must contain at least one weekday');
  }

  const holidayValues =
    options?.holidays === undefined ? [] : requireDenseArray(options.holidays, 'holidays');
  const holidays: string[] = [];
  for (const value of holidayValues) {
    if (typeof value !== 'string') {
      throw new TypeError('holidays entries must be strings');
    }
    parseDay(value);
    holidays.push(value);
  }

  return { holidays, weekdays };
}

export function createWorkCalendar(options?: WorkCalendarOptions): WorkCalendar {
  const configuration = readOptions(options);
  const holidayMembers = new Set(configuration.holidays);
  const workingHolidayOrdinals = Array.from(holidayMembers, (holiday) => parseDay(holiday))
    .filter((ordinal) => configuration.weekdays[weekday(ordinal)])
    .sort((left, right) => left - right);
  const workingWeekdayCount = configuration.weekdays.reduce(
    (count, selected) => count + Number(selected),
    0,
  );

  const rank = (ordinal: number): number => {
    if (ordinal < 0) return 0;

    const includedDays = ordinal + 1;
    const completeWeeks = Math.floor(includedDays / 7);
    const remainder = includedDays % 7;
    let selectedDays = completeWeeks * workingWeekdayCount;
    const remainderStart = completeWeeks * 7;
    for (let offset = 0; offset < remainder; offset += 1) {
      if (configuration.weekdays[weekday(remainderStart + offset)]) selectedDays += 1;
    }

    return selectedDays - lowerBound(workingHolidayOrdinals, ordinal + 1);
  };

  const selectRank = (target: number, low: number, high: number): number => {
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (rank(middle) >= target) high = middle;
      else low = middle + 1;
    }
    return low;
  };

  const isHoliday = (day: string): boolean => {
    parseDay(day);
    return holidayMembers.has(day);
  };

  const isWorkday = (day: string): boolean => {
    const ordinal = parseDay(day);
    return configuration.weekdays[weekday(ordinal)] && !holidayMembers.has(day);
  };

  const countWorkdays = (start: string, end: string): number => {
    const startOrdinal = parseDay(start);
    const endOrdinal = parseDay(end);
    if (startOrdinal === endOrdinal) return 0;

    if (startOrdinal < endOrdinal) {
      return rank(endOrdinal - 1) - rank(startOrdinal - 1);
    }
    const result = rank(startOrdinal - 1) - rank(endOrdinal - 1);
    return result === 0 ? 0 : -result;
  };

  const addWorkdays = (day: string, amount: number): string => {
    const startOrdinal = parseDay(day);
    if (typeof amount !== 'number') {
      throw new TypeError('amount must be a number');
    }
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError('amount must be a safe integer');
    }
    if (amount === 0) return day;

    if (amount > 0) {
      const startRank = rank(startOrdinal);
      if (amount > rank(MAX_ORDINAL) - startRank) {
        throw new RangeError('result is outside the supported date range');
      }
      return formatDay(selectRank(startRank + amount, startOrdinal + 1, MAX_ORDINAL));
    }

    const available = rank(startOrdinal - 1);
    if (-amount > available) {
      throw new RangeError('result is outside the supported date range');
    }
    const target = available + amount + 1;
    return formatDay(selectRank(target, 0, startOrdinal - 1));
  };

  return Object.freeze({ addWorkdays, countWorkdays, isHoliday, isWorkday });
}
