import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { splitCategoryGaps, splitTimeGaps } from '../dist/gap-lines.js';

test('aligns category samples and bridges each bounded missing run', () => {
  assert.deepEqual(
    splitCategoryGaps(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [['B', 2], ['D', 7], ['E', 8], ['G', 4]],
    ),
    {
      solid: [[0, null], [1, 2], [2, null], [3, 7], [4, 8], [5, null], [6, 4], [7, null]],
      bridges: [[1, 2], [3, 7], [3, null], [4, 8], [6, 4], [6, null]],
      gapCount: 2,
    },
  );
});

test('aligns unordered samples while preserving zero and negative values', () => {
  assert.deepEqual(
    splitCategoryGaps(['A', 'B', 'C', 'D'], [['D', -3], ['B', 0], ['A', 4]]),
    {
      solid: [[0, 4], [1, 0], [2, null], [3, -3]],
      bridges: [[1, 0], [3, -3], [3, null]],
      gapCount: 1,
    },
  );
});

test('handles empty, all-null, single-point, adjacent, and repeated category gaps', () => {
  const cases = [
    [[], [], { solid: [], bridges: [], gapCount: 0 }],
    [['A', 'B'], [['A', null], ['B', null]], { solid: [[0, null], [1, null]], bridges: [], gapCount: 0 }],
    [['A'], [['A', 5]], { solid: [[0, 5]], bridges: [], gapCount: 0 }],
    [['A', 'B'], [['A', 1], ['B', 2]], { solid: [[0, 1], [1, 2]], bridges: [], gapCount: 0 }],
    [
      ['A', 'B', 'C', 'D', 'E', 'F'],
      [['A', 1], ['C', 2], ['F', 3]],
      {
        solid: [[0, 1], [1, null], [2, 2], [3, null], [4, null], [5, 3]],
        bridges: [[0, 1], [2, 2], [2, null], [2, 2], [5, 3], [5, null]],
        gapCount: 2,
      },
    ],
  ];

  for (const [categories, samples, expected] of cases) {
    assert.deepEqual(splitCategoryGaps(categories, samples), expected);
  }
});

test('returns category tuples that do not alias input tuples', () => {
  const categories = ['A', 'B', 'C'];
  const first = ['A', 1];
  const third = ['C', 3];
  const samples = [third, first];
  const result = splitCategoryGaps(categories, samples);

  result.solid[0][1] = 99;
  result.bridges[0][1] = 88;

  assert.deepEqual(categories, ['A', 'B', 'C']);
  assert.deepEqual(samples, [['C', 3], ['A', 1]]);
  assert.notEqual(result.solid[0], first);
  assert.notEqual(result.bridges[0], first);
});

test('rejects malformed category input with the documented error classes', () => {
  const sparseCategories = ['A', , 'C'];
  const sparseSamples = [['A', 1], , ['C', 3]];
  const malformedTuple = ['A'];
  const sparseTuple = [];
  sparseTuple.length = 2;
  sparseTuple[0] = 'A';

  for (const [categories, samples] of [
    [null, []],
    [['A'], null],
    [sparseCategories, []],
    [['A'], sparseSamples],
    [[1], []],
    [['A'], [malformedTuple]],
    [['A'], [sparseTuple]],
    [['A'], [[1, 2]]],
    [['A'], [['A', undefined]]],
  ]) {
    assert.throws(() => splitCategoryGaps(categories, samples), TypeError);
  }

  for (const [categories, samples] of [
    [['A', 'A'], []],
    [['A'], [['B', 1]]],
    [['A'], [['A', 1], ['A', 2]]],
    [['A'], [['A', Number.NaN]]],
    [['A'], [['A', Number.POSITIVE_INFINITY]]],
  ]) {
    assert.throws(() => splitCategoryGaps(categories, samples), RangeError);
  }
});

test('detects omitted time intervals only when they exceed the threshold', () => {
  assert.deepEqual(splitTimeGaps([[0, 2], [1000, 3], [3000, 7]], 1000), {
    solid: [[0, 2], [1000, 3], [2000, null], [3000, 7]],
    bridges: [[1000, 3], [3000, 7], [3000, null]],
    gapCount: 1,
  });
  assert.equal(splitTimeGaps([[0, 2], [1000, 3]], 1000).gapCount, 0);
});

test('groups explicit nulls and omitted intervals between measured time points', () => {
  assert.deepEqual(
    splitTimeGaps([[0, 1], [1000, null], [4000, null], [5000, 2]], 1000),
    {
      solid: [[0, 1], [1000, null], [2500, null], [4000, null], [5000, 2]],
      bridges: [[0, 1], [5000, 2], [5000, null]],
      gapCount: 1,
    },
  );
});

test('does not bridge leading or trailing time gaps', () => {
  assert.deepEqual(splitTimeGaps([[0, null], [2000, 2], [3000, null]], 1000), {
    solid: [[0, null], [1000, null], [2000, 2], [3000, null]],
    bridges: [],
    gapCount: 0,
  });
});

test('handles empty, all-null, one-point, adjacent, repeated, negative, and wide time cases', () => {
  const cases = [
    [[], 1, { solid: [], bridges: [], gapCount: 0 }],
    [[[0, null], [1, null]], 1, { solid: [[0, null], [1, null]], bridges: [], gapCount: 0 }],
    [[[-1, 0]], 1, { solid: [[-1, 0]], bridges: [], gapCount: 0 }],
    [[[-2, -4], [-1, 0]], 1, { solid: [[-2, -4], [-1, 0]], bridges: [], gapCount: 0 }],
    [
      [[-4000, -2], [-3000, null], [-2000, -1], [2000, 0], [3000, null], [4000, 3]],
      1000,
      {
        solid: [[-4000, -2], [-3000, null], [-2000, -1], [0, null], [2000, 0], [3000, null], [4000, 3]],
        bridges: [[-4000, -2], [-2000, -1], [-2000, null], [-2000, -1], [2000, 0], [2000, null], [2000, 0], [4000, 3], [4000, null]],
        gapCount: 3,
      },
    ],
    [
      [[0, 1], [8_000_000, 2]],
      1,
      {
        solid: [[0, 1], [4_000_000, null], [8_000_000, 2]],
        bridges: [[0, 1], [8_000_000, 2], [8_000_000, null]],
        gapCount: 1,
      },
    ],
  ];

  for (const [samples, threshold, expected] of cases) {
    assert.deepEqual(splitTimeGaps(samples, threshold), expected);
  }
});

test('returns time tuples that do not alias or mutate input tuples', () => {
  const first = [-1000, 0];
  const second = [1000, -2];
  const samples = [first, second];
  const result = splitTimeGaps(samples, 1000);

  result.solid[0][1] = 99;
  result.bridges[0][1] = 88;

  assert.deepEqual(samples, [[-1000, 0], [1000, -2]]);
  assert.notEqual(result.solid[0], first);
  assert.notEqual(result.bridges[0], first);
});

test('rejects malformed time input with the documented error classes', () => {
  const sparseSamples = [[0, 1], , [2, 3]];
  const sparseTuple = [];
  sparseTuple.length = 2;
  sparseTuple[0] = 0;

  for (const [samples, threshold] of [
    [null, 1],
    [sparseSamples, 1],
    [[[0]], 1],
    [[sparseTuple], 1],
    [[['0', 1]], 1],
    [[[0, undefined]], 1],
    [[], '1'],
  ]) {
    assert.throws(() => splitTimeGaps(samples, threshold), TypeError);
  }

  for (const [samples, threshold] of [
    [[], 0],
    [[], -1],
    [[], 1.5],
    [[], Number.MAX_SAFE_INTEGER + 1],
    [[[0.5, 1]], 1],
    [[[8_640_000_000_000_001, 1]], 1],
    [[[0, Number.NaN]], 1],
    [[[0, Number.NEGATIVE_INFINITY]], 1],
    [[[1, 1], [1, 2]], 1],
    [[[2, 1], [1, 2]], 1],
  ]) {
    assert.throws(() => splitTimeGaps(samples, threshold), RangeError);
  }
});

test('generated declarations accept readonly inputs and expose output types', async () => {
  const directory = await mkdtemp(join(process.cwd(), '.types-'));
  const source = join(directory, 'contract.ts');
  const relativeImport = '../dist/gap-lines.js';
  await writeFile(source, [
    `import { splitCategoryGaps, splitTimeGaps, type GapData, type Point } from '${relativeImport}';`,
    "const categories = ['A', 'B'] as const;",
    "const categorySamples = [['A', 0], ['B', null]] as const;",
    'const categoryResult: GapData = splitCategoryGaps(categories, categorySamples);',
    'const point: Point = categoryResult.solid[0]!;',
    'categoryResult.solid[0] = point;',
    'const timeSamples = [[0, -1], [1000, 2]] as const;',
    'const timeResult: GapData = splitTimeGaps(timeSamples, 1000);',
    'void timeResult;',
  ].join('\n'));

  try {
    const result = spawnSync(process.execPath, [
      resolve('node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target', 'ES2022',
      '--module', 'NodeNext',
      '--moduleResolution', 'NodeNext',
      source,
    ], { cwd: process.cwd(), encoding: 'utf8' });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
