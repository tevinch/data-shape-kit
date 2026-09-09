import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { consumeCsv } from './consume-csv.mjs';

async function main() {
  const fileArguments = process.argv.slice(2);
  if (fileArguments.length > 1) {
    throw new Error('Expected at most one CSV file path');
  }

  const csvPath = fileArguments[0] ?? fileURLToPath(new URL('./sample.csv', import.meta.url));
  const sample = [];
  const result = await consumeCsv(
    createReadStream(csvPath, { highWaterMark: 64 * 1024 }),
    async (row) => {
      if (sample.length < 2) sample.push(row);
    },
  );

  process.stdout.write(`${JSON.stringify({ ...result, sample }, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
