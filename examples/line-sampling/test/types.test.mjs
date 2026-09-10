import assert from "node:assert/strict";
import { mkdir, rm, writeFile, cp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(projectRoot, "output", "type-consumer");

test("strict TypeScript consumes readonly generic declarations", async () => {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const source = `
import { sampleLine, type SampleLineResult } from "../../dist/sample-line.js";
import { SampledLineChart, type LinePoint } from "../../dist/SampledLineChart.js";

interface Reading extends LinePoint {
  readonly label: string;
}

const readings: readonly Reading[] = Object.freeze([
  { x: 0, y: 1, label: "first" },
  { x: 1, y: null, label: "gap" },
  { x: 2, y: 3, label: "last" },
]);
const result: SampleLineResult<Reading> = sampleLine(readings, {
  x: (row, index) => row.x + index * 0,
  y: (row, index) => index === 1 ? null : row.y,
  maxPoints: 3,
});
const firstLabel: string = result.data[0].label;
const chart = <SampledLineChart
  data={readings}
  maxPoints={3}
  width={640}
  height={300}
  title={firstLabel}
  xLabel="Index"
  yLabel="Reading"
/>;
void chart;
`;
  await writeFile(path.join(outputDirectory, "consumer.tsx"), source);
  await writeFile(path.join(outputDirectory, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      jsx: "react-jsx",
      skipLibCheck: true,
    },
    files: ["consumer.tsx"],
  }));

  const result = spawnSync(process.execPath, [
    path.join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
    "-p",
    path.join(outputDirectory, "tsconfig.json"),
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("the compiled core imports from an isolated directory without React", async () => {
  const isolatedDirectory = path.join(projectRoot, "output", "isolated-core");
  await rm(isolatedDirectory, { recursive: true, force: true });
  await mkdir(isolatedDirectory, { recursive: true });
  await cp(path.join(projectRoot, "dist", "sample-line.js"), path.join(isolatedDirectory, "sample-line.mjs"));

  const core = await import(`${pathToFileURL(path.join(isolatedDirectory, "sample-line.mjs")).href}?isolated=1`);
  const result = core.sampleLine([{ x: 0, y: 1 }, { x: 1, y: 2 }], {
    x: (row) => row.x,
    y: (row) => row.y,
    maxPoints: 2,
  });
  assert.deepEqual(result.indices, [0, 1]);
});
