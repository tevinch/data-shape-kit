// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

// Build tools stay outside the distributed package. See README for setup.
const dependencies = process.argv[2];
if (!dependencies) throw new Error('Usage: node build-react.mjs /path/to/node_modules');
const dependencyRoot = resolve(dependencies);
const require = createRequire(import.meta.url);
const ts = require(join(dependencyRoot, 'typescript/lib/typescript.js'));
const directory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(directory, '../../examples/react-markdown-table');
const source = join(sourceDirectory, 'markdown-table-generator.tsx');
const output = join(directory, 'react');
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  skipLibCheck: true,
  declaration: true,
  noEmitOnError: true,
  rootDir: sourceDirectory,
  outDir: output,
  types: [],
  paths: {
    react: [join(dependencyRoot, '@types/react/index.d.ts')],
    'react/*': [join(dependencyRoot, '@types/react/*')],
  },
};
const program = ts.createProgram([source], options);
const files = new Map();
const emitted = program.emit(undefined, (name, text) => files.set(name, text));
const diagnostics = [...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics];
if (emitted.emitSkipped || diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else {
  const js = files.get(join(output, 'markdown-table-generator.js'));
  const declaration = files.get(join(output, 'markdown-table-generator.d.ts'));
  if (!js || !declaration) throw new Error('Expected React output was not generated.');
  const oldImport = '../../javascript/markdown-table/index.mjs';
  if (js.split(oldImport).length !== 2) throw new Error('Expected one conversion-module import.');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'index.js'), js.replace(oldImport, '../index.mjs'));
  await writeFile(join(output, 'index.d.ts'), declaration.replaceAll(oldImport, '../index.mjs'));
  console.log(`Built React entry with TypeScript ${ts.version}.`);
}
