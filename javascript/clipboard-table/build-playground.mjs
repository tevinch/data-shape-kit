// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const here = new URL('./', import.meta.url);
const [template, parser, controller, license] = await Promise.all(
  ['playground.html', 'index.mjs', 'playground.mjs', 'LICENSE'].map(name => fs.readFile(new URL(name, here), 'utf8'))
);
const script = `\n${parser}\n${controller.replace(/^import .* from '\.\/index\.mjs';\n/m, '')}\n`;
if (/<\/script/i.test(script) || /\bimport\s/.test(script)) throw Error('The inline example must have no imports or closing script tags');
const style = template.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if (!style) throw Error('Missing stylesheet');
const hash = value => `sha256-${createHash('sha256').update(value).digest('base64')}`;
const output = template.replace('__PLAYGROUND_SCRIPT__', script)
  .replace('__SCRIPT_CSP__', hash(script)).replace('__STYLE_CSP__', hash(style))
  .replace('<!doctype html>', `<!doctype html>\n<!--\n${license.trim()}\n-->`);
if (/__[A-Z_]+__/.test(output)) throw Error('Unresolved build placeholder');
await fs.mkdir(new URL('../../downloads/', here), { recursive: true });
const target = new URL('../../downloads/clipboard-table-playground.html', here);
await fs.writeFile(target, output);
console.log('Built downloads/clipboard-table-playground.html (self-contained; no runtime dependencies).');
