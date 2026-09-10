import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('emitted declarations support the public API and enforce readonly contracts', async () => {
  const directory = await mkdtemp(join(root, 'test/.types-'));
  const source = join(directory, 'consumer.tsx');
  const modulePath = resolve(root, 'dist/pdf-contents.js');
  await writeFile(source, `
import React from 'react';
import { Document } from '@react-pdf/renderer';
import {
  ContentsConvergenceError,
  renderWithContents,
  type ContentsEntry,
  type ContentsResult,
  type Heading,
  type RenderContentsOptions,
  type ResolvedContentsEntry,
} from '${modulePath}';

const headings: readonly Heading[] = [{ id: 'intro', title: 'Intro' }];
const options: RenderContentsOptions = {
  headings,
  buildDocument: (_entries: readonly ContentsEntry[]) => <Document />,
};
const pending: Promise<ContentsResult> = renderWithContents(options);
const resolved: ResolvedContentsEntry = { id: 'intro', title: 'Intro', level: 1, pageNumber: 1 };
const reason: 'cycle' | 'limit' = new ContentsConvergenceError('cycle', 2).reason;
void pending;
void resolved;
void reason;

// @ts-expect-error readonly heading member
headings[0].title = 'Changed';
// @ts-expect-error readonly result member
pending.then((result) => { result.passes = 9; });
// @ts-expect-error resolved page numbers cannot be null
const invalid: ResolvedContentsEntry = { id: 'x', title: 'X', level: 1, pageNumber: null };
void invalid;
`, 'utf8');

  try {
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '--strict',
        '--target', 'ES2022',
        '--module', 'NodeNext',
        '--moduleResolution', 'NodeNext',
        '--jsx', 'react-jsx',
        '--skipLibCheck',
        '--types', 'node',
        source,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
