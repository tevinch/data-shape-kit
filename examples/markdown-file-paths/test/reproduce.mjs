import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'test/roundtrip.test.mjs'], {
  env: { ...process.env, STOCK: '1' }, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
