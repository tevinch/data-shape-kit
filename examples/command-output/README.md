# Command output capture and preview

Run a finite test or build command to completion, retain all of its stdout and stderr in a private temporary file, display its first 120 lines, and return the command's exit code. The wrapper is a POSIX shell script for macOS and Linux and requires `mktemp` and `head`.

[Download or copy `preview-run.sh`](preview-run.sh?raw=true) into any convenient local directory. It does not need to be inside the project being tested.

## Run Vitest from your project

Change to the project whose tests you want to run, then put the wrapper before the exact command and arguments you would otherwise use:

```sh
cd /path/to/your-project
sh /path/to/preview-run.sh npx vitest run src/example.test.ts
```

The script keeps that working directory and stdin. It invokes the command exactly once as the argument vector after `preview-run.sh`; it does not parse or evaluate a command string. Quote spaces and shell metacharacters at the calling shell, just as you would for a direct invocation:

```sh
sh /path/to/preview-run.sh node script.mjs '' 'two words' 'literal;value'
```

Before the command starts, stderr identifies the retained file:

```text
Full output: /tmp/command-output.ABC123
```

Use the printed path to inspect late errors and the complete output, then remove the file when it is no longer needed:

```sh
less /tmp/command-output.ABC123
rm -- /tmp/command-output.ABC123
```

The preview goes to stdout. The log contains combined stdout and stderr in their captured order. A successful command returns 0; a normal nonzero command exit, including 127 when the command is not found, remains the wrapper's exit status. A preview error does not replace it. Calling the wrapper without a command returns 64. If the private log cannot be created, it returns 125 and does not run the command.

## Scope and limits

This wrapper is for finite commands. Capture finishes before preview begins, so output is not live. It does not impose a timeout, supervise or kill processes, handle signals, or protect against SIGKILL and orphaned processes. It installs no dependencies, changes no persistent configuration, makes no network requests, uploads nothing, and does not delete the log automatically.

The retained file can grow to the command's complete output. The 120-line preview is neither a byte limit nor a storage limit. Because output is redirected to a file, programs may buffer or format it differently than they do in a terminal. Always inspect the log for messages after line 120.

This is an invocation workaround for the early pipe closure described in [Vitest #11241](https://github.com/vitest-dev/vitest/issues/11241). It avoids sending a live command directly through `head`; it does not repair Vitest's IPC handling or reproduce or fix the reported OOM race. The contributor's [worker IPC patch and reproduction](https://github.com/vitest-dev/vitest/compare/main...Gaurav1112:fix/worker-dead-ipc-loop) remain relevant upstream work.

## Run checks

Node.js 20 or newer is required only for the tests. From the repository root:

```sh
node --test examples/command-output/preview-run.test.mjs
sh -n examples/command-output/preview-run.sh
```

The behavioral tests use a bounded local producer and real processes. They cover completion past the preview boundary, complete retained output, statuses 0, 7 and 127, exact argument preservation, usage, log-creation failure, and preview failure. Direct integration with Vitest is outside this example's built-in test suite.

## License

[MIT](LICENSE). Use, modify and share the code, retaining the license notice.

## Buy me a coffee, if this helped

This example is free. If it saves you some time and you feel like buying me a coffee, a small contribution is welcome and entirely optional. Useful feedback is appreciated too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please use the asset and network shown above.
