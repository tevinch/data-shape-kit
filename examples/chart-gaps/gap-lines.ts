export type Point = [x: number, y: number | null];

export interface GapData {
  solid: Point[];
  bridges: Point[];
  gapCount: number;
}

const MAX_DATE_MS = 8_640_000_000_000_000;

function requireDenseArray(value: unknown, name: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      throw new TypeError(`${name} must not be sparse`);
    }
  }
}

function requireTuple(value: unknown, name: string): asserts value is [unknown, unknown] {
  requireDenseArray(value, name);
  if (value.length !== 2) {
    throw new TypeError(`${name} must contain exactly two items`);
  }
}

function requireMeasurement(value: unknown, name: string): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number or null`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
  return value;
}

function splitAlignedPoints(solid: Point[]): GapData {
  const bridges: Point[] = [];
  let gapCount = 0;
  let lastMeasured: Point | undefined;
  let missingSinceLastMeasurement = false;

  for (const [x, y] of solid) {
    if (y === null) {
      if (lastMeasured !== undefined) {
        missingSinceLastMeasurement = true;
      }
      continue;
    }

    if (lastMeasured !== undefined && missingSinceLastMeasurement) {
      bridges.push(
        [lastMeasured[0], lastMeasured[1]],
        [x, y],
        [x, null],
      );
      gapCount += 1;
    }

    lastMeasured = [x, y];
    missingSinceLastMeasurement = false;
  }

  return { solid, bridges, gapCount };
}

export function splitCategoryGaps(
  categories: readonly string[],
  samples: readonly (readonly [string, number | null])[],
): GapData {
  requireDenseArray(categories, 'categories');
  requireDenseArray(samples, 'samples');

  const categoryIndexes = new Map<string, number>();
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    if (typeof category !== 'string') {
      throw new TypeError(`categories[${index}] must be a string`);
    }
    if (categoryIndexes.has(category)) {
      throw new RangeError(`duplicate category: ${category}`);
    }
    categoryIndexes.set(category, index);
  }

  const measurements = new Map<number, number | null>();
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    requireTuple(sample, `samples[${index}]`);
    const category = sample[0];
    if (typeof category !== 'string') {
      throw new TypeError(`samples[${index}][0] must be a string`);
    }
    const categoryIndex = categoryIndexes.get(category);
    if (categoryIndex === undefined) {
      throw new RangeError(`unknown category: ${category}`);
    }
    if (measurements.has(categoryIndex)) {
      throw new RangeError(`duplicate sample category: ${category}`);
    }
    measurements.set(categoryIndex, requireMeasurement(sample[1], `samples[${index}][1]`));
  }

  const solid: Point[] = categories.map((_, index) => [index, measurements.get(index) ?? null]);
  return splitAlignedPoints(solid);
}

export function splitTimeGaps(
  samples: readonly (readonly [number, number | null])[],
  maxIntervalMs: number,
): GapData {
  if (typeof maxIntervalMs !== 'number') {
    throw new TypeError('maxIntervalMs must be a number');
  }
  if (!Number.isSafeInteger(maxIntervalMs) || maxIntervalMs <= 0) {
    throw new RangeError('maxIntervalMs must be a positive safe integer');
  }
  requireDenseArray(samples, 'samples');

  const validated: Point[] = [];
  let previousTime: number | undefined;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    requireTuple(sample, `samples[${index}]`);
    const time = sample[0];
    if (typeof time !== 'number') {
      throw new TypeError(`samples[${index}][0] must be a number`);
    }
    if (!Number.isInteger(time) || Math.abs(time) > MAX_DATE_MS) {
      throw new RangeError(`samples[${index}][0] must be an integer in the JavaScript Date range`);
    }
    if (previousTime !== undefined && time <= previousTime) {
      throw new RangeError('sample timestamps must be strictly increasing');
    }
    validated.push([time, requireMeasurement(sample[1], `samples[${index}][1]`)]);
    previousTime = time;
  }

  const solid: Point[] = [];
  for (let index = 0; index < validated.length; index += 1) {
    const point = validated[index];
    if (index > 0) {
      const previous = validated[index - 1];
      if (point[0] - previous[0] > maxIntervalMs) {
        solid.push([previous[0] / 2 + point[0] / 2, null]);
      }
    }
    solid.push([point[0], point[1]]);
  }

  return splitAlignedPoints(solid);
}
