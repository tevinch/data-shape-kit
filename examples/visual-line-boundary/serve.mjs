import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/bundle.js', ['bundle.js', 'text/javascript; charset=utf-8']],
]);
createServer(async (request, response) => {
  const entry = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(new URL(entry[0], import.meta.url));
    response.writeHead(200, {'Content-Type': entry[1], 'Cache-Control': 'no-store'}).end(body);
  } catch {
    response.writeHead(500).end('Run npm run build first.');
  }
}).listen(8771, '127.0.0.1', () => console.log('Open http://127.0.0.1:8771'));
