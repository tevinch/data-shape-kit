# Rebuild from FullCalendar source

Use Node 24.19.0 and pnpm 10.15.0. The source correction targets official FullCalendar v7.1.2. React source is generated from shared Preact source during the official build, so apply the patch to Preact and force the React build.

Run these commands from this example directory to create a fresh source checkout under `.source-build/upstream`:

```sh
set -eu
example_dir=$(pwd)
mkdir -p .source-build/upstream .source-build/packages
curl -fL https://codeload.github.com/fullcalendar/fullcalendar/tar.gz/refs/tags/v7.1.2 -o .source-build/source.tar.gz
printf '%s  %s\n' 011dd19c6d6b1ad0c5aa515c7152ee9b533f99d5171f92327cba1628e5e8a3f0 .source-build/source.tar.gz | shasum -a 256 -c -
tar -xzf .source-build/source.tar.gz --strip-components=1 -C .source-build/upstream
cd .source-build/upstream
patch -p1 < "$example_dir/source.patch"
pnpm --config.use-node-version=24.19.0 install --ignore-scripts --no-frozen-lockfile --filter=@fullcalendar/react... --filter=@fullcalendar/preact...
pnpm --config.use-node-version=24.19.0 run postinstall
pnpm --config.use-node-version=24.19.0 run build --all --filter=@fullcalendar/react --force
pnpm --config.use-node-version=24.19.0 --dir packages/react pack --pack-destination "$example_dir/.source-build/packages"
```

The explicit root `postinstall` writes development package metadata used to resolve workspace dependencies. Dependency lifecycle scripts remain disabled during installation. `pack` runs from the package root and honors FullCalendar's `publishConfig.directory`, converting workspace dependency references into published versions. The output is `.source-build/packages/fullcalendar-react-7.1.2.tgz`. Rename it to `fullcalendar-react-7.1.2-row-lifecycle.tgz` before distribution so it remains distinct from the official package. The package version stays 7.1.2 to preserve upstream dependency compatibility; the file name and source patch identify this unofficial build.

The official lock failed a frozen install because its package-extension checksum did not match pnpm 10.15.0. The successful build used `--no-frozen-lockfile`; this recipe therefore does not promise a byte-identical upstream release or a frozen dependency graph. The supplied example uses its own fixed npm lock and a built archive. Observed source-build warnings concerned old Browserslist data, an empty core declaration chunk, and existing TypeScript/Rollup peer ranges. The checked runtime was Node 24.19.0, while the inspected upstream CI selected 24.15.0.

## Source regression and existing tests

Copy these two files into the shared-source package and run the separate test configuration:

```sh
cp "$example_dir/upstream-tests/daygrid-row-lifecycle.test.ts" packages/preact/tests/
cp "$example_dir/upstream-tests/daygrid-row-lifecycle.vitest.config.ts" packages/preact/tests/
pnpm --config.use-node-version=24.19.0 --dir packages/preact exec vitest run --config tests/daygrid-row-lifecycle.vitest.config.ts --reporter=verbose
pnpm --config.use-node-version=24.19.0 --dir packages/preact run test
pnpm --config.use-node-version=24.19.0 --dir packages/react run test
pnpm --config.use-node-version=24.19.0 --dir packages/react run typecheck
pnpm --config.use-node-version=24.19.0 --dir packages/headless-calendar run test
pnpm --config.use-node-version=24.19.0 run build --all --filter=@fullcalendar/preact --force
```

The four new source assertions passed with the correction. With the original row implementation, only replay reconnection failed: the current height ref received no restored measurement. The watcher double models single-listener and synchronous-acquisition boundaries; actual browser geometry and completed operations are covered by the example's Chrome checks.

To compare the corrected build with a source rollback, reverse `source.patch`, repeat the forced React build and pack, install that archive into a separate copy of the example, and run `npm test`. The first StrictMode drop should fail on the original row. Reapply the patch, force-build and pack again, then install the corrected archive into a fresh example copy. If replacing the example's archive, update its npm lock before `npm ci` so the stored integrity matches your build. Keep the dependency name `@fullcalendar/react` and the existing calendar settings.
