import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const [mode = 'baseline', packagePath] = process.argv.slice(2)
if (!['baseline', 'packaged'].includes(mode) || (mode === 'packaged' && !packagePath)) {
  throw new Error('Use: node build.mjs baseline | node build.mjs packaged /path/to/consumer/node_modules/@headlessui/react')
}
const folder = fileURLToPath(new URL('.', import.meta.url))
await build({
  absWorkingDir: folder,
  entryPoints: ['main.jsx'],
  outfile: `${mode}.js`,
  bundle: true,
  minify: true,
  sourcemap: true,
  format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    react: `${folder}node_modules/react`,
    'react-dom': `${folder}node_modules/react-dom`,
    ...(mode === 'packaged' ? { '@headlessui/react': resolve(packagePath) } : {}),
  },
})
