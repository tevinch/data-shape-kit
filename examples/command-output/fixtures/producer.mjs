import { writeFile } from 'node:fs/promises';

const [markerPath, exitCodeText, ...receivedArguments] = process.argv.slice(2);
const exitCode = Number(exitCodeText);

if (!markerPath || !Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
  process.stderr.write('Usage: node producer.mjs marker-path exit-code [argument ...]\n');
  process.exit(64);
}

process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

function write(stream, text) {
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

try {
  for (let line = 1; line <= 120; line += 1) {
    await write(process.stdout, `line-${String(line).padStart(3, '0')}\n`);
  }

  await new Promise((resolve) => setTimeout(resolve, 30));

  for (let line = 121; line <= 125; line += 1) {
    await write(process.stdout, `line-${String(line).padStart(3, '0')}\n`);
  }
  await write(process.stderr, 'late stderr after preview boundary\n');
  await writeFile(markerPath, JSON.stringify(receivedArguments), 'utf8');
  process.exitCode = exitCode;
} catch {
  process.exitCode = 74;
}
