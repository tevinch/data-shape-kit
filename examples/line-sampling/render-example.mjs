import { mkdir, writeFile } from "node:fs/promises";

import { mountSampledLineChart } from "./render-chart.mjs";
import { sampleData } from "./dist/sample-data.js";

function geometry(container) {
  const path = container.querySelector(".recharts-line-curve");
  if (path === null) throw new Error("Recharts did not render a line path");
  const d = path.getAttribute("d") ?? "";
  return {
    finiteCount: (d.match(/[ML]/g) ?? []).length,
    pathSegments: (d.match(/M/g) ?? []).length,
  };
}

function chartMarkup(container) {
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("Recharts did not render an SVG");
  return svg.innerHTML;
}

let original;
let sampled;
try {
  original = await mountSampledLineChart({
    data: sampleData,
    maxPoints: 8_000,
    width: 940,
    height: 310,
    title: "Original data",
    xLabel: "Sample index",
    yLabel: "Value",
  }, { rootId: "original-preview" });
  sampled = await mountSampledLineChart({
    data: sampleData,
    maxPoints: 320,
    width: 940,
    height: 310,
    title: "Bounded sample",
    xLabel: "Sample index",
    yLabel: "Value",
  }, { rootId: "sampled-preview" });

  const originalGeometry = geometry(original.container);
  const sampledGeometry = geometry(sampled.container);
  const summary = {
    sourceCount: sampleData.length,
    selectedCount: sampled.selectedData.length,
    originalFiniteCount: originalGeometry.finiteCount,
    selectedFiniteCount: sampledGeometry.finiteCount,
    originalPathSegments: originalGeometry.pathSegments,
    selectedPathSegments: sampledGeometry.pathSegments,
  };
  const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800">
  <rect width="1000" height="800" fill="#f8fafc"/>
  <text x="30" y="42" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="#0f172a">Line sampling comparison</text>
  <text x="30" y="68" font-family="system-ui, sans-serif" font-size="14" fill="#475569">Same full domains · missing-data boundaries preserved</text>
  <g transform="translate(20 90)">
    <rect width="960" height="330" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="20" y="28" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#0f172a">Original · 8,000 points</text>
    <svg x="10" y="34" width="940" height="285" viewBox="0 0 940 310">${chartMarkup(original.container)}</svg>
  </g>
  <g transform="translate(20 440)">
    <rect width="960" height="330" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="20" y="28" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#0f172a">Bounded sample · 320 points</text>
    <svg x="10" y="34" width="940" height="285" viewBox="0 0 940 310">${chartMarkup(sampled.container)}</svg>
  </g>
</svg>`;

  await mkdir(new URL("./output/", import.meta.url), { recursive: true });
  await writeFile(new URL("./output/preview.svg", import.meta.url), preview);
  await writeFile(new URL("./output/summary.json", import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally {
  if (sampled !== undefined) await sampled.close();
  if (original !== undefined) await original.close();
}
