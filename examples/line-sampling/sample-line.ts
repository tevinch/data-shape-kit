export interface SampleLineOptions<T> {
  readonly x: (row: T, index: number) => number;
  readonly y: (row: T, index: number) => number | null;
  readonly maxPoints: number;
}

export interface SampleLineResult<T> {
  readonly data: readonly T[];
  readonly indices: readonly number[];
  readonly sourceCount: number;
  readonly minimumPoints: number;
}

export class PointBudgetError extends RangeError {
  readonly requiredPoints: number;
  readonly maxPoints: number;

  constructor(requiredPoints: number, maxPoints: number) {
    super(`maxPoints ${maxPoints} cannot preserve the required ${requiredPoints} run-boundary points`);
    this.name = "PointBudgetError";
    this.requiredPoints = requiredPoints;
    this.maxPoints = maxPoints;
  }
}

interface Run {
  readonly start: number;
  readonly end: number;
  readonly isNull: boolean;
  readonly mandatory: number;
  readonly capacity: number;
}

function validateOptions<T>(value: SampleLineOptions<T>): SampleLineOptions<T> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("options must be a plain object");
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("options must be a plain object");
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 3 ||
    keys.some((key) => typeof key !== "string") ||
    !Object.hasOwn(value, "x") ||
    !Object.hasOwn(value, "y") ||
    !Object.hasOwn(value, "maxPoints")
  ) {
    throw new TypeError("options must have exactly the own keys x, y, and maxPoints");
  }

  const x = value.x;
  const y = value.y;
  const maxPoints = value.maxPoints;
  if (typeof x !== "function" || typeof y !== "function") {
    throw new TypeError("x and y must be functions");
  }
  if (typeof maxPoints !== "number") {
    throw new TypeError("maxPoints must be a number");
  }
  if (!Number.isSafeInteger(maxPoints) || maxPoints < 2) {
    throw new RangeError("maxPoints must be a safe integer of at least 2");
  }

  return { x, y, maxPoints };
}

function findRuns(ys: readonly (number | null)[]): Run[] {
  const runs: Run[] = [];
  let start = 0;
  while (start < ys.length) {
    const isNull = ys[start] === null;
    let end = start + 1;
    while (end < ys.length && (ys[end] === null) === isNull) {
      end += 1;
    }
    const length = end - start;
    runs.push({
      start,
      end,
      isNull,
      mandatory: Math.min(length, 2),
      capacity: isNull ? 0 : Math.max(0, length - 2),
    });
    start = end;
  }
  return runs;
}

function allocateExtras(runs: readonly Run[], extra: number, totalCapacity: number): number[] {
  const allocations = Array(runs.length).fill(0) as number[];
  if (extra === 0 || totalCapacity === 0) return allocations;

  const denominator = BigInt(totalCapacity);
  const remainders: { index: number; remainder: bigint }[] = [];
  let allocated = 0;

  runs.forEach((run, index) => {
    if (run.capacity === 0) return;
    const product = BigInt(extra) * BigInt(run.capacity);
    const base = Number(product / denominator);
    allocations[index] = base;
    allocated += base;
    remainders.push({ index, remainder: product % denominator });
  });

  remainders.sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let offset = 0; offset < extra - allocated; offset += 1) {
    allocations[remainders[offset].index] += 1;
  }
  return allocations;
}

function selectFiniteRun(
  run: Run,
  target: number,
  xs: readonly number[],
  ys: readonly (number | null)[],
): number[] {
  const length = run.end - run.start;
  if (target >= length) {
    return Array.from({ length }, (_, offset) => run.start + offset);
  }
  if (target === 1) return [run.start];
  if (target === 2) return [run.start, run.end - 1];

  let xScale = 0;
  let yScale = 0;
  for (let index = run.start; index < run.end; index += 1) {
    xScale = Math.max(xScale, Math.abs(xs[index]));
    yScale = Math.max(yScale, Math.abs(ys[index] as number));
  }
  if (xScale === 0) xScale = 1;
  if (yScale === 0) yScale = 1;

  const every = (length - 2) / (target - 2);
  const selected = [run.start];
  let previous = run.start;

  for (let bucket = 0; bucket < target - 2; bucket += 1) {
    const candidateStart = Math.min(
      run.end - 1,
      run.start + Math.floor(bucket * every) + 1,
    );
    const candidateEnd = Math.min(
      run.end - 1,
      run.start + Math.floor((bucket + 1) * every) + 1,
    );
    const averageStart = Math.min(
      run.end - 1,
      run.start + Math.floor((bucket + 1) * every) + 1,
    );
    const averageEnd = Math.min(
      run.end,
      run.start + Math.floor((bucket + 2) * every) + 1,
    );

    let averageX = 0;
    let averageY = 0;
    const averageCount = averageEnd - averageStart;
    for (let index = averageStart; index < averageEnd; index += 1) {
      averageX += xs[index] / xScale;
      averageY += (ys[index] as number) / yScale;
    }
    averageX /= averageCount;
    averageY /= averageCount;

    const previousX = xs[previous] / xScale;
    const previousY = (ys[previous] as number) / yScale;
    let bestIndex = candidateStart;
    let bestArea = -1;
    for (let index = candidateStart; index < candidateEnd; index += 1) {
      const candidateX = xs[index] / xScale;
      const candidateY = (ys[index] as number) / yScale;
      const area = Math.abs(
        (previousX - averageX) * (candidateY - previousY) -
        (previousX - candidateX) * (averageY - previousY),
      );
      if (area > bestArea) {
        bestArea = area;
        bestIndex = index;
      }
    }
    selected.push(bestIndex);
    previous = bestIndex;
  }

  selected.push(run.end - 1);
  return selected;
}

export function sampleLine<T>(
  data: readonly T[],
  options: SampleLineOptions<T>,
): SampleLineResult<T> {
  if (!Array.isArray(data)) {
    throw new TypeError("data must be an array");
  }
  for (let index = 0; index < data.length; index += 1) {
    if (!Object.hasOwn(data, index)) {
      throw new TypeError("data must be a dense array with own entries");
    }
  }
  const validated = validateOptions(options);

  const xs: number[] = [];
  const ys: (number | null)[] = [];
  for (let index = 0; index < data.length; index += 1) {
    const x = validated.x(data[index], index);
    const y = validated.y(data[index], index);
    if (typeof x !== "number") throw new TypeError("x values must be numbers");
    if (!Number.isFinite(x)) throw new RangeError("x values must be finite");
    if (y !== null && typeof y !== "number") {
      throw new TypeError("y values must be numbers or null");
    }
    if (typeof y === "number" && !Number.isFinite(y)) {
      throw new RangeError("y values must be finite or null");
    }
    if (index > 0 && x < xs[index - 1]) {
      throw new RangeError("x values must be nondecreasing");
    }
    xs.push(x);
    ys.push(y);
  }

  const runs = findRuns(ys);
  const minimumPoints = runs.reduce((total, run) => total + run.mandatory, 0);
  let indices: number[];

  if (data.length <= validated.maxPoints) {
    indices = Array.from({ length: data.length }, (_, index) => index);
  } else {
    if (validated.maxPoints < minimumPoints) {
      throw new PointBudgetError(minimumPoints, validated.maxPoints);
    }
    const totalCapacity = runs.reduce((total, run) => total + run.capacity, 0);
    const extra = Math.min(validated.maxPoints - minimumPoints, totalCapacity);
    const allocations = allocateExtras(runs, extra, totalCapacity);
    indices = [];
    runs.forEach((run, runIndex) => {
      const target = run.mandatory + allocations[runIndex];
      if (run.isNull) {
        indices.push(run.start);
        if (run.end - run.start > 1) indices.push(run.end - 1);
      } else {
        for (const index of selectFiniteRun(run, target, xs, ys)) {
          indices.push(index);
        }
      }
    });
  }

  const selectedData = indices.map((index) => data[index]);
  return Object.freeze({
    data: Object.freeze(selectedData),
    indices: Object.freeze(indices),
    sourceCount: data.length,
    minimumPoints,
  });
}
