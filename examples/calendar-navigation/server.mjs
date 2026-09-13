import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = await mkdtemp(join(tmpdir(), 'calendar-navigation-'));

await build({
  entryPoints: [join(root, 'example.js')],
  bundle: true,
  format: 'esm',
  outfile: join(output, 'bundle.js'),
  sourcemap: true,
});

const files = new Map([
  ['/', { path: join(root, 'index.html'), type: 'text/html; charset=utf-8' }],
  ['/bundle.js', { path: join(output, 'bundle.js'), type: 'text/javascript; charset=utf-8' }],
  ['/bundle.js.map', { path: join(output, 'bundle.js.map'), type: 'application/json; charset=utf-8' }],
  ['/bundle.css', { path: join(output, 'bundle.css'), type: 'text/css; charset=utf-8' }],
  ['/bundle.css.map', { path: join(output, 'bundle.css.map'), type: 'application/json; charset=utf-8' }],
]);

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const file = files.get(path);
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    response.writeHead(200, { 'content-type': file.type });
    response.end(await readFile(file.path));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log(`Calendar navigation demo: http://127.0.0.1:${address.port}`);
});

async function close() {
  server.close();
  await rm(output, { recursive: true, force: true });
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
