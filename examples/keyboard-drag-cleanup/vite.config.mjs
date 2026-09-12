import react from '@vitejs/plugin-react'
import {join, resolve} from 'node:path'
import {defineConfig} from 'vite'

export default defineConfig(() => {
  const packageRoot = process.env.REACT_ARIA_PACKAGE_ROOT
  const format = process.env.REACT_ARIA_FORMAT ?? 'mjs'
  if (!['mjs', 'js', 'cjs'].includes(format)) {
    throw new Error(`Unsupported REACT_ARIA_FORMAT ${JSON.stringify(format)}`)
  }

  return {
    plugins: [react()],
    resolve: packageRoot ? {
      alias: [
        {
          find: /^react-aria\/(.+)$/,
          replacement: `${join(packageRoot, 'dist/exports')}/$1.${format}`,
        },
        {
          find: /^react-aria$/,
          replacement: join(packageRoot, `dist/exports/index.${format}`),
        },
      ],
    } : undefined,
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: resolve(import.meta.dirname, 'fixture/index.html'),
      },
    },
    server: {
      host: '127.0.0.1',
    },
  }
})
