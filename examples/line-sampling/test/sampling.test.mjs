import assert from "node:assert/strict";
import test from "node:test";

import { PointBudgetError, sampleLine } from "../dist/sample-line.js";

const rows = (values) => values.map((y, x) => ({ x, y, label: `row-${x}` }));
const options = (maxPoints) => ({
  x: (row) => row.x,
  y: (row) => row.y,
  maxPoints,
});

test("selects the hand-calculated LTTB points for a ten-point line", () => {
  const result = sampleLine(rows([0, 2, 9, 2, 0, 3, 7, 1, 4, 0]), options(6));
  assert.deepEqual(result.indices, [0, 2, 4, 6, 7, 9]);
});

test("preserves separated positive and negative spikes in the hand-calculated fixture", () => {
  const result = sampleLine(
    rows([0, 0, 20, 0, 0, -15, 0, 0, 0, 25, 0, 0]),
    options(5),
  );
  assert.deepEqual(result.indices, [0, 2, 5, 9, 11]);
});

test("chooses the earliest original point when triangle areas tie", () => {
  const result = sampleLine(rows(Array(10).fill(4)), options(6));
  assert.deepEqual(result.indices, [0, 1, 3, 5, 7, 9]);
});

test("allocates one budget across finite and null runs while preserving every boundary", () => {
  const data = rows([
    0, 1, 4, 2, 8, 3, 5, 0,
    null, null,
    2, 9, 3, 1,
    null,
    0, 4, 1, 7, 2, 0,
  ]);

  const result = sampleLine(data, options(14));

  assert.equal(result.minimumPoints, 9);
  assert.equal(result.data.length, 14);
  assert.deepEqual(
    [0, 7, 8, 9, 10, 13, 14, 15, 20].map((index) => result.indices.includes(index)),
    Array(9).fill(true),
  );
  assert.equal(result.indices.filter((index) => index >= 0 && index <= 7).length, 4);
  assert.equal(result.indices.filter((index) => index >= 10 && index <= 13).length, 3);
  assert.equal(result.indices.filter((index) => index >= 15 && index <= 20).length, 4);
});

test("throws a typed error when the cap cannot preserve run boundaries", () => {
  const data = rows([1, 2, null, null, 3, 4]);
  assert.throws(
    () => sampleLine(data, options(5)),
    (error) => {
      assert.ok(error instanceof PointBudgetError);
      assert.ok(error instanceof RangeError);
      assert.equal(error.requiredPoints, 6);
      assert.equal(error.maxPoints, 5);
      return true;
    },
  );
});

test("compresses a long all-null run to its two boundary markers", () => {
  const result = sampleLine(rows(Array(100).fill(null)), options(2));
  assert.deepEqual(result.indices, [0, 99]);
  assert.equal(result.minimumPoints, 2);
});

test("keeps all original rows when the cap covers the input", () => {
  const data = rows([1, null, null, 2, 3]);
  const result = sampleLine(data, options(data.length));
  assert.deepEqual(result.indices, [0, 1, 2, 3, 4]);
  assert.deepEqual(result.data, data);
});

test("handles empty, singleton, pair, budget-two, and alternating-run inputs", () => {
  const empty = sampleLine([], options(2));
  assert.deepEqual(empty.indices, []);
  assert.equal(empty.sourceCount, 0);
  assert.equal(empty.minimumPoints, 0);

  assert.deepEqual(sampleLine(rows([3]), options(2)).indices, [0]);
  assert.deepEqual(sampleLine(rows([3, 4]), options(2)).indices, [0, 1]);
  assert.deepEqual(sampleLine(rows([3, 1, 4, 2]), options(2)).indices, [0, 3]);

  const alternating = rows([1, null, 2, null, 3]);
  const alternatingResult = sampleLine(alternating, options(5));
  assert.deepEqual(alternatingResult.indices, [0, 1, 2, 3, 4]);
  assert.equal(alternatingResult.minimumPoints, 5);
});

test("preserves generic row metadata, exact references, indices, and input immutability", () => {
  const data = Object.freeze(
    rows([0, 8, 1, 5, 0]).map((row) => Object.freeze({ ...row, meta: { id: row.label } })),
  );
  const before = data.map((row) => ({ ...row }));

  const result = sampleLine(data, options(3));

  assert.deepEqual(data, before);
  result.indices.forEach((sourceIndex, selectedIndex) => {
    assert.equal(result.data[selectedIndex], data[sourceIndex]);
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.data));
  assert.ok(Object.isFrozen(result.indices));
  assert.equal(Object.isFrozen(data[0].meta), false);
});

test("calls each selector once per row with the original index", () => {
  const data = rows([0, 2, null, 7, 1]);
  const xCalls = [];
  const yCalls = [];
  sampleLine(data, {
    x(row, index) {
      xCalls.push([row, index]);
      return row.x;
    },
    y(row, index) {
      yCalls.push([row, index]);
      return row.y;
    },
    maxPoints: 5,
  });

  assert.deepEqual(xCalls.map((entry) => entry[1]), [0, 1, 2, 3, 4]);
  assert.deepEqual(yCalls.map((entry) => entry[1]), [0, 1, 2, 3, 4]);
  assert.deepEqual(xCalls.map((entry) => entry[0]), data);
  assert.deepEqual(yCalls.map((entry) => entry[0]), data);
});

test("accepts duplicate x coordinates and keeps independent result state", () => {
  const data = [
    { x: 0, y: 0 },
    { x: 0, y: 8 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
  ];
  const first = sampleLine(data, options(3));
  const second = sampleLine(data, options(3));
  assert.deepEqual(first.indices, second.indices);
  assert.notEqual(first, second);
  assert.notEqual(first.data, second.data);
  assert.notEqual(first.indices, second.indices);
});

test("normalizes extreme finite coordinates before area calculations", () => {
  const data = [0, 2, 9, 2, 0, 3, 7, 1, 4, 0].map((y, index) => ({
    x: index * 1e307,
    y: y * 1e307,
  }));
  const result = sampleLine(data, options(6));
  assert.deepEqual(result.indices, [0, 2, 4, 6, 7, 9]);
});

test("rejects non-array data, sparse arrays, and inherited array entries", () => {
  assert.throws(() => sampleLine({}, options(2)), TypeError);

  const sparse = [{ x: 0, y: 0 }, , { x: 2, y: 2 }];
  assert.throws(() => sampleLine(sparse, options(2)), TypeError);

  const inherited = [{ x: 0, y: 0 }, , { x: 2, y: 2 }];
  Array.prototype[1] = { x: 1, y: 1 };
  try {
    assert.throws(() => sampleLine(inherited, options(2)), TypeError);
  } finally {
    delete Array.prototype[1];
  }
});

test("requires an exact plain options shape with no extra string or symbol keys", () => {
  const data = rows([1, 2]);
  assert.throws(() => sampleLine(data, null), TypeError);
  assert.throws(() => sampleLine(data, []), TypeError);
  assert.throws(() => sampleLine(data, { ...options(2), extra: true }), TypeError);
  assert.throws(
    () => sampleLine(data, { ...options(2), [Symbol("extra")]: true }),
    TypeError,
  );

  const nullPrototypeOptions = Object.assign(Object.create(null), options(2));
  assert.deepEqual(sampleLine(data, nullPrototypeOptions).indices, [0, 1]);
});

test("validates selector types and a primitive safe integer cap of at least two", () => {
  const data = rows([1, 2]);
  for (const invalidX of [null, 1, "x"]) {
    assert.throws(() => sampleLine(data, { ...options(2), x: invalidX }), TypeError);
  }
  for (const invalidY of [null, 1, "y"]) {
    assert.throws(() => sampleLine(data, { ...options(2), y: invalidY }), TypeError);
  }
  for (const invalidCap of [new Number(2), 2.5, 1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    const ErrorType = typeof invalidCap === "number" ? RangeError : TypeError;
    assert.throws(() => sampleLine(data, { ...options(2), maxPoints: invalidCap }), ErrorType);
  }
});

test("validates options before invoking selectors, including for empty input", () => {
  let calls = 0;
  const x = () => { calls += 1; return 0; };
  const y = () => { calls += 1; return 0; };
  assert.throws(() => sampleLine(rows([1]), { x, y, maxPoints: 1 }), RangeError);
  assert.equal(calls, 0);
  assert.throws(() => sampleLine([], { x, y, maxPoints: 1 }), RangeError);
  assert.equal(calls, 0);
});

test("rejects invalid coordinates and descending x values without coercion", () => {
  const cases = [
    [[{ x: "0", y: 0 }, { x: 1, y: 1 }], TypeError],
    [[{ x: NaN, y: 0 }, { x: 1, y: 1 }], RangeError],
    [[{ x: Infinity, y: 0 }, { x: 1, y: 1 }], RangeError],
    [[{ x: 0, y: undefined }, { x: 1, y: 1 }], TypeError],
    [[{ x: 0, y: "1" }, { x: 1, y: 1 }], TypeError],
    [[{ x: 0, y: Infinity }, { x: 1, y: 1 }], RangeError],
    [[{ x: 2, y: 0 }, { x: 1, y: 1 }], RangeError],
  ];
  for (const [data, ErrorType] of cases) {
    assert.throws(() => sampleLine(data, options(2)), ErrorType);
  }
});

test("propagates accessor exceptions unchanged", () => {
  const thrown = new Error("selector stopped");
  assert.throws(
    () => sampleLine(rows([1, 2]), {
      x: () => { throw thrown; },
      y: (row) => row.y,
      maxPoints: 2,
    }),
    (error) => error === thrown,
  );
});
