import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([
  ['/', ['dist/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['dist/app.js', 'text/javascript; charset=utf-8']],
]);
createServer(async (request, response) => {
  const entry = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!entry) { response.writeHead(404).end('Not found'); return; }
  try {
    const body = await readFile(entry[0]);
    response.writeHead(200, {'Content-Type': entry[1], 'Cache-Control':'no-store'}).end(body);
  } catch {
    response.writeHead(503).end('Run npm run build first.');
  }
}).listen(8785, '127.0.0.1', () => console.log('Open http://127.0.0.1:8785'));
