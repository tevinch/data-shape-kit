import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { tz } from '@date-fns/tz';
import { addBusinessDays, format } from 'date-fns';

import { createWorkCalendar } from '../dist/work-calendar.js';

const here = dirname(fileURLToPath(import.meta.url));
const project = dirname(here);
const UTC = tz('UTC');

test('extracts a zoned date before applying the holiday-aware calendar', () => {
  const Shanghai = tz('Asia/Shanghai');
  const instant = new Date('2026-01-01T12:00:00+08:00');
  const day = format(instant, 'yyyy-MM-dd', { in: Shanghai });
  const native = format(addBusinessDays(instant, 1, { in: Shanghai }), 'yyyy-MM-dd', {
    in: Shanghai,
  });
  const custom = createWorkCalendar({ holidays: ['2026-01-02'] }).addWorkdays(day, 1);

  assert.equal(day, '2026-01-01');
  assert.equal(native, '2026-01-02');
  assert.equal(custom, '2026-01-05');
});

test('matches date-fns default business-day addition with explicit UTC context', () => {
  const cases = [
    ['2026-01-02', 1],
    ['2026-01-03', 1],
    ['2026-01-03', -1],
    ['2024-02-28', 2],
    ['2024-03-01', -2],
    ['2000-02-28', 1],
  ];
  const calendar = createWorkCalendar();

  for (const [day, amount] of cases) {
    const instant = new Date(`${day}T12:00:00Z`);
    const expected = format(addBusinessDays(instant, amount, { in: UTC }), 'yyyy-MM-dd', {
      in: UTC,
    });
    assert.equal(calendar.addWorkdays(day, amount), expected, `${day} ${amount}`);
  }
});

test('is independent of the host process timezone', () => {
  const expected = { custom: '2026-01-05', day: '2026-01-01', native: '2026-01-02' };
  const zones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Shanghai', 'Pacific/Apia'];

  for (const TZ of zones) {
    const output = execFileSync(process.execPath, [join(here, 'host-check.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, TZ },
    });
    assert.deepEqual(JSON.parse(output), expected, TZ);
  }
});

test('emits declarations consumable with readonly options and methods', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'work-calendar-types-'));
  try {
    cpSync(join(project, 'dist', 'work-calendar.d.ts'), join(temporary, 'work-calendar.d.ts'));
    writeFileSync(join(temporary, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      join(temporary, 'consumer.ts'),
      `import { createWorkCalendar, type WorkCalendarOptions } from './work-calendar.js';

const weekdays = [1, 2, 3, 4, 5] as const;
const holidays = ['2026-01-02'] as const;
const options: WorkCalendarOptions = { workingWeekdays: weekdays, holidays };
const calendar = createWorkCalendar(options);
const result: string = calendar.addWorkdays('2026-01-01', 1);
// @ts-expect-error WorkCalendar methods are readonly.
calendar.isWorkday = () => true;
console.log(result);
`,
    );

    execFileSync(
      process.execPath,
      [
        join(project, 'node_modules', 'typescript', 'bin', 'tsc'),
        '--noEmit',
        '--strict',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        'consumer.ts',
      ],
      { cwd: temporary, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
