import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const { outputFiles } = await build({ entryPoints: [new URL('./app.mjs', import.meta.url).pathname], bundle: true, write: false, format: 'esm' });
const html = await readFile(new URL('./index.html', import.meta.url));
createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
  } else if (path === '/app.js') {
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.end(outputFiles[0].contents);
  } else {
    response.writeHead(404); response.end('Not found');
  }
}).listen(49186, '127.0.0.1', () => console.log('Open http://127.0.0.1:49186'));
