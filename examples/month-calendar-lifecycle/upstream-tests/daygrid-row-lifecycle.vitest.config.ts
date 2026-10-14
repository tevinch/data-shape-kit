import { defineConfig } from 'vitest/config'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../package.json', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('../', import.meta.url)),
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: require.resolve('preact/jsx-runtime') },
      { find: /^react-dom\/client$/, replacement: require.resolve('preact/compat/client') },
      { find: /^react-dom$/, replacement: require.resolve('preact/compat') },
      { find: /^react$/, replacement: require.resolve('preact/compat') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/daygrid-row-lifecycle.test.ts'],
    globals: true,
  },
})
