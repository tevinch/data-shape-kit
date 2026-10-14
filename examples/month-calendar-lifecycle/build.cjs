const path = require('node:path');
const fs = require('node:fs/promises');
const esbuild = require('esbuild');
async function build(mode) {
  if (!['fixed', 'stable'].includes(mode)) throw new Error('Use fixed or stable');
  const plugins = mode === 'stable' ? [{ name: 'calendar-version', setup(build) { build.onResolve({ filter: /^@fullcalendar\/react(?:\/|$)/ }, args => ({ path: require.resolve(args.path.replace('@fullcalendar/react', 'calendar-stable')) })); } }] : [];
  const dest = path.join(__dirname, 'dist', mode);
  await esbuild.build({ entryPoints: [path.join(__dirname, 'src/index.tsx')], outfile: path.join(dest, 'app.js'), bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins });
  await fs.writeFile(path.join(dest, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><script defer src="/app.js"></script><title>Month calendar</title></head><body><div id="root"></div></body></html>');
}
module.exports = { build };
if (require.main === module) (async () => { for (const mode of ['stable', 'fixed']) await build(mode); console.log('Built month calendar'); })().catch(error => { console.error(error); process.exitCode = 1; });
