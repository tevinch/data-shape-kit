import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const original = process.argv.includes('--original');
function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Check exited with ${code ?? signal}`)));
  });
}
for (const format of ['esm', 'cjs']) {
  await run(['node_modules/vite/bin/vite.js', 'build'], { GRID_FORMAT: format });
  const server = await preview({ configFile: false, root, build: { outDir: `dist-${format}` }, preview: { host: '127.0.0.1', port: 0 } });
  try {
    const port = server.httpServer.address().port;
    await run(['verify-browser.mjs', ...(original ? ['--original'] : [])], {
      CHECK_URL: `http://127.0.0.1:${port}`,
      CHECK_OUTPUT: `.checks/${original ? 'original' : 'patched'}-${format}`,
    });
  } finally {
    server.httpServer.closeAllConnections();
    await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  }
}
