import assert from "node:assert/strict";
import test from "node:test";

import { mountSampledLineChart } from "../render-chart.mjs";
import { sampleData } from "../dist/sample-data.js";

function pathShape(container) {
  const path = container.querySelector(".recharts-line-curve");
  assert.ok(path, "expected Recharts to render a line curve");
  const d = path.getAttribute("d") ?? "";
  return {
    d,
    vertices: (d.match(/[ML]/g) ?? []).length,
    segments: (d.match(/M/g) ?? []).length,
  };
}

function axisLabels(container, axisClass) {
  return [...container.querySelectorAll(`${axisClass}-tick-labels .recharts-cartesian-axis-tick-value`)]
    .map((node) => node.textContent);
}

test("the deterministic fixture has the specified size, gaps, and isolated spikes", () => {
  assert.equal(sampleData.length, 8_000);
  assert.equal(sampleData.filter((row) => row.y !== null).length, 7_845);
  assert.ok(sampleData.slice(2_600, 2_675).every((row) => row.y === null));
  assert.ok(sampleData.slice(5_300, 5_380).every((row) => row.y === null));
  assert.equal(sampleData[2_599].y === null, false);
  assert.equal(sampleData[2_675].y === null, false);
  assert.equal(sampleData[5_299].y === null, false);
  assert.equal(sampleData[5_380].y === null, false);
  assert.equal(sampleData[1_200].y, 180);
  assert.equal(sampleData[4_100].y, -170);
  assert.equal(sampleData[6_700].y, 200);
});

test("client-mounted Recharts renders actual bounded geometry with preserved gaps and spikes", async () => {
  const mounted = await mountSampledLineChart({
    data: sampleData,
    maxPoints: 320,
    width: 960,
    height: 360,
    title: "Sampled",
    xLabel: "Sample index",
    yLabel: "Value",
  }, { rootId: "sampled-test" });

  try {
    const shape = pathShape(mounted.container);
    assert.equal(shape.vertices, 316);
    assert.equal(shape.segments, 3);
    assert.equal(mounted.container.querySelectorAll(".recharts-line-dot").length, 0);
    assert.match(mounted.container.textContent, /8,000 source points/);
    assert.match(mounted.container.textContent, /320 displayed points/);

    for (const spike of [sampleData[1_200], sampleData[4_100], sampleData[6_700]]) {
      assert.ok(mounted.selectedData.includes(spike));
    }
  } finally {
    await mounted.close();
  }
});

test("the unsampled fixture renders every finite vertex in three path segments", async () => {
  const mounted = await mountSampledLineChart({
    data: sampleData,
    maxPoints: 8_000,
    width: 960,
    height: 360,
    title: "Original",
  }, { rootId: "original-test" });

  try {
    assert.deepEqual(pathShape(mounted.container), {
      d: pathShape(mounted.container).d,
      vertices: 7_845,
      segments: 3,
    });
  } finally {
    await mounted.close();
  }
});

test("uses original domains and rerenders when the budget or data reference changes", async () => {
  const firstData = [
    { x: 0, y: 0 },
    { x: 1, y: 100 },
    { x: 2, y: 0 },
  ];
  const mounted = await mountSampledLineChart({
    data: firstData,
    maxPoints: 2,
    width: 640,
    height: 300,
    title: "Changing",
  }, { rootId: "update-test" });

  try {
    assert.ok(axisLabels(mounted.container, ".recharts-yAxis").includes("100"));
    assert.equal(mounted.selectedData.length, 2);

    await mounted.render({
      data: firstData,
      maxPoints: 3,
      width: 640,
      height: 300,
      title: "Changing",
    });
    assert.equal(mounted.selectedData.length, 3);

    const secondData = [
      { x: 10, y: -50 },
      { x: 20, y: 50 },
    ];
    await mounted.render({
      data: secondData,
      maxPoints: 2,
      width: 640,
      height: 300,
      title: "Changed data",
    });
    assert.deepEqual(mounted.selectedData, secondData);
    assert.ok(axisLabels(mounted.container, ".recharts-xAxis").includes("10"));
    assert.ok(axisLabels(mounted.container, ".recharts-xAxis").includes("20"));
    assert.ok(axisLabels(mounted.container, ".recharts-yAxis").includes("-50"));
    assert.ok(axisLabels(mounted.container, ".recharts-yAxis").includes("50"));
  } finally {
    await mounted.close();
  }
});

test("propagates sampler validation and point-budget failures", async () => {
  await assert.rejects(
    mountSampledLineChart({
      data: [{ x: 0, y: 1 }, { x: 1, y: null }, { x: 2, y: 2 }],
      maxPoints: 2,
      width: 640,
      height: 300,
    }, { rootId: "error-test" }),
    (error) => error?.name === "PointBudgetError",
  );
});
