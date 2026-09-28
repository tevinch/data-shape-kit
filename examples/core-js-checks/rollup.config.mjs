import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { keepCoreJsChecks } from './keep-core-js-checks.mjs';

export default () => ({
  input: fileURLToPath(new URL('entry.mjs', import.meta.url)),
  plugins: [nodeResolve(), commonjs(), keepCoreJsChecks()],
  output: {
    file: fileURLToPath(new URL('dist/example.cjs', import.meta.url)),
    format: 'cjs',
  },
});
