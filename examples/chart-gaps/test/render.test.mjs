import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import * as echarts from 'echarts';
import { splitCategoryGaps, splitTimeGaps } from '../dist/gap-lines.js';

const SOLID_COLOR = '#2457d6';
const BRIDGE_COLOR = '#d97706';

function renderSvg(option, width = 500, height = 240) {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  try {
    chart.setOption({ animation: false, ...option });
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}

function linePath(svg, color) {
  const paths = svg.match(/<path\b[^>]*>/g) ?? [];
  const matches = paths.filter((path) =>
    path.includes(`stroke=\"${color}\"`) && path.includes('fill="none"'),
  );
  assert.equal(matches.length, 1, `expected one ${color} line path, received:\n${matches.join('\n')}`);
  return matches[0];
}

function pathGeometry(path) {
  const data = /\bd="([^"]+)"/.exec(path)?.[1];
  assert.ok(data, `path has no geometry: ${path}`);
  return [...data.matchAll(/([ML])?\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((match) => [
    match[1] ?? 'L',
    Number(match[2]),
    Number(match[3]),
  ]);
}

function assertGeometry(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(actual[index][0], expected[index][0]);
    assert.ok(Math.abs(actual[index][1] - expected[index][1]) < 0.11, `${actual[index][1]} != ${expected[index][1]}`);
    assert.ok(Math.abs(actual[index][2] - expected[index][2]) < 0.11, `${actual[index][2]} != ${expected[index][2]}`);
  }
}

function series(name, data) {
  return [
    {
      name,
      type: 'line',
      data: data.solid,
      connectNulls: false,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: SOLID_COLOR },
      lineStyle: { color: SOLID_COLOR, width: 2 },
    },
    {
      name,
      type: 'line',
      data: data.bridges,
      connectNulls: false,
      symbol: 'none',
      silent: true,
      tooltip: { show: false },
      lineStyle: { color: BRIDGE_COLOR, type: 'dashed', width: 2 },
    },
  ];
}

test('category SSR draws only the measured segment and the two bounded dashed bridges', () => {
  const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const data = splitCategoryGaps(categories, [['B', 2], ['D', 7], ['E', 8], ['G', 4]]);
  const svg = renderSvg({
    grid: { left: 50, right: 50, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value', min: 0, max: 10 },
    series: series('Readings', data),
  });

  const solid = linePath(svg, SOLID_COLOR);
  const bridge = linePath(svg, BRIDGE_COLOR);
  assertGeometry(pathGeometry(solid), [
    ['M', 125, 164],
    ['M', 225, 74], ['L', 275, 56],
    ['M', 375, 128],
  ]);
  assertGeometry(pathGeometry(bridge), [
    ['M', 125, 164], ['L', 225, 74],
    ['M', 275, 56], ['L', 375, 128],
  ]);
  assert.match(bridge, /stroke-dasharray="8,4"/);
  assert.doesNotMatch(solid, /stroke-dasharray=/);
});

test('time SSR disconnects the wide interval and dashes only its measured endpoints', () => {
  const data = splitTimeGaps([[0, 2], [1000, 3], [3000, 7], [4000, 8]], 1000);
  const svg = renderSvg({
    grid: { left: 50, right: 50, top: 20, bottom: 40 },
    xAxis: { type: 'time', min: 0, max: 4000 },
    yAxis: { type: 'value', min: 0, max: 10 },
    series: series('Readings', data),
  });

  const solid = linePath(svg, SOLID_COLOR);
  const bridge = linePath(svg, BRIDGE_COLOR);
  assertGeometry(pathGeometry(solid), [
    ['M', 50, 164], ['L', 150, 146],
    ['M', 350, 74], ['L', 450, 56],
  ]);
  assertGeometry(pathGeometry(bridge), [['M', 150, 146], ['L', 350, 74]]);
  assert.match(bridge, /stroke-dasharray="8,4"/);
  assert.doesNotMatch(solid, /stroke-dasharray=/);
});

test('preview generator writes the labeled category and time SVG fixture', async () => {
  const result = spawnSync(process.execPath, ['render-example.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const svg = await readFile(new URL('../preview.svg', import.meta.url), 'utf8');
  assert.match(svg, /<svg[^>]+width="900"[^>]+height="620"/);
  assert.match(svg, />Category readings</);
  assert.match(svg, />Time readings</);
  assert.match(svg, />Solid blue: observed sequence/);
  assert.match(svg, /stroke="#2457d6"/);
  assert.match(svg, /stroke="#d97706"[^>]+stroke-dasharray="8,4"/);
  assert.doesNotMatch(svg, /\/Users\//);
});
