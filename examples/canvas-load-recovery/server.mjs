import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aav8AAAAASUVORK5CYII=', 'base64');

// Only local fixtures are served. Pending images make cancellation reproducible.
export async function startServer(port = 0) {
  const requests = new Map();
  const pending = new Map();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const id = url.searchParams.get('id') || 'demo';
    const count = () => requests.set(id, (requests.get(id) || 0) + 1);
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/missing.png') {
      count();
      res.writeHead(404).end('Missing fixture');
      return;
    }
    if (url.pathname === '/pending.png') {
      count();
      const responses = pending.get(id) || new Set();
      responses.add(res);
      pending.set(id, responses);
      res.on('close', () => responses.delete(res));
      return;
    }
    if (url.pathname === '/stats') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ requests: requests.get(id) || 0, pending: pending.get(id)?.size || 0 }));
      return;
    }
    if (url.pathname === '/release') {
      for (const response of pending.get(id) || []) {
        response.writeHead(200, { 'Content-Type': 'image/png' }).end(pixel);
      }
      res.end('released');
      return;
    }
    try {
      const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const path = resolve(root, `.${pathname}`);
      if (!path.startsWith(root)) throw new Error('Outside example');
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      for (const responses of pending.values()) for (const res of responses) res.destroy();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT || 8080));
  console.log(`Open ${server.url}`);
}
