import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

await build({ entryPoints: [fileURLToPath(new URL('browser.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('bundle.js', import.meta.url)), bundle: true, platform: 'browser', format: 'esm' });
const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/bundle.js', ['bundle.js', 'text/javascript; charset=utf-8']],
]);
const server = createServer(async (request, response) => {
  const route = routes.get(request.url?.split('?')[0]);
  if (request.method !== 'GET' || !route) { response.writeHead(404); response.end(); return; }
  try {
    const bytes = await readFile(new URL(route[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); response.end(bytes);
  } catch {
    response.writeHead(500); response.end('Unable to load local fixture.');
  }
});
server.listen(0, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${server.address().port}`));
