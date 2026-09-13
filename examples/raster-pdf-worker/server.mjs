import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
export async function startServer({ checks = false, port = 0 } = {}) {
  const outdir = join(root, '.build');
  await mkdir(outdir, { recursive: true });
  const entries = { main: 'main.js', 'pdf-worker': 'pdf-worker.js' };
  if (checks) Object.assign(entries, { fixture: 'test/fixture.js', control: 'test/control.js' });
  await build({ absWorkingDir: root, entryPoints: entries, outdir, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof', external: ['canvg', 'dompurify', 'html2canvas'], logLevel: 'silent' });
  const files = new Map([['/', join(root, 'index.html')], ['/index.html', join(root, 'index.html')], ['/assets/main.js', join(outdir, 'main.js')], ['/assets/pdf-worker.js', join(outdir, 'pdf-worker.js')]]);
  if (checks) for (const key of ['fixture', 'control']) files.set(`/assets/${key}.js`, join(outdir, `${key}.js`));
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (checks && (path === '/checks' || path === '/control')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><title>PDF export check</title><script type="module" src="/assets/${path === '/checks' ? 'fixture' : 'control'}.js"></script>`);
      return;
    }
    const file = files.get(path);
    if (!file) { response.writeHead(404); response.end('Not found'); return; }
    try {
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' });
      response.end(bytes);
    } catch { response.writeHead(500); response.end('Could not read example file'); }
  });
  await new Promise((res, rej) => { server.once('error', rej); server.listen(port, '127.0.0.1', res); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((res, rej) => { server.closeAllConnections(); server.close(error => error ? rej(error) : res()); }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer(); console.log(server.url);
}
