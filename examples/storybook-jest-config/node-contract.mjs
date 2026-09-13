import assert from 'node:assert/strict';
import nodeModule from 'node:module';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] || 'typescript';
const unexpected = mode === 'unexpected-value' ? 'registration failed' : new Error('registration failed');
if (mode.startsWith('unexpected-')) {
  nodeModule.register = () => { throw unexpected; };
  nodeModule.syncBuiltinESMExports();
}
const { serverRequire } = await import('storybook/internal/common');
const file = name => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));
if (mode.startsWith('unexpected-')) {
  await assert.rejects(serverRequire(file('enum-config.ts')), error => error === unexpected);
} else if (mode === 'broken') {
  await assert.rejects(serverRequire(file('broken-config.ts')), /fixture configuration error/);
} else {
  assert.deepEqual(await serverRequire(file('enum-config.ts')), { state: 7 });
}
console.log(`Node configuration: ${mode} passed`);
