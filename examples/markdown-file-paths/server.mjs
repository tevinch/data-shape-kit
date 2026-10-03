import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const { outputFiles } = await build({
  entryPoints: ['app.mjs'], bundle: true, write: false, format: 'esm',
});
const html = await readFile(new URL('./index.html', import.meta.url));
createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
  } else if (path === '/app.js') {
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.end(outputFiles[0].contents);
  } else if (path === '/images/My%20Photo.svg') {
    response.setHeader('Content-Type', 'image/svg+xml');
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90"><rect width="180" height="90" fill="#e1eaf1"/><text x="24" y="50" font-size="18">Sample image</text></svg>');
  } else if (path === '/docs/My%20Plan.md') {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Sample plan. This file is served locally.');
  } else {
    response.writeHead(404); response.end('Not found');
  }
}).listen(49180, '127.0.0.1', () => console.log('Open http://127.0.0.1:49180'));
