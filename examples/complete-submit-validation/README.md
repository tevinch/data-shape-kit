# Complete submit validation

Show current field and form errors on every submit, then save once after the values are valid. This focused patch targets **TanStack Form 1.33.5** forms using **`canSubmitWhenInvalid: true`**.

On the original package, a previous form error can stop the next submit before form validation runs. A failing field validator also stops form validation, leaving errors on other fields undisclosed. The patch runs both stages before returning an invalid result, retains field-level error priority, and keeps the default/false option's existing behavior.

[Download source, patch and tests](https://github.com/tevinch/data-shape-kit/raw/main/downloads/complete-submit-validation-source.zip) · [Reported workflows](https://github.com/TanStack/form/issues/2130)

## Run the comparison

Use Node 24, npm and Git. From this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run reproduce  # expected nonzero: original package fails 15 of 27 checks
npm test           # patched source, ESM and CommonJS: 27 of 27 checks pass
npm run build
python3 -m http.server 8772 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8772/`. Use **Original package** or **Patched package** and choose a scenario. The repeated-submit and mixed-validation instructions finish with the actual saved values shown on the page. This demo stores values only in page memory.

The test/build scripts copy the pinned dependency into a temporary directory and apply the patch there. Version and SHA-256 checks reject altered input files. They leave installed dependencies unchanged and remove their temporary copy afterwards. `npm run reproduce` intentionally reports failures; it is a comparison, not a passing CI command.

## Use in an application

Review [the complete patch](patches/form-core-1.33.5.patch). It includes TypeScript source, ESM/CommonJS output and matching declarations. Pin `@tanstack/form-core` and your TanStack Form adapter to **1.33.5**, then persist the patch with your package manager's dependency-patching mechanism. The patch paths are relative to the `@tanstack/form-core` package directory. For example, in an isolated checkout containing that exact package:

```sh
# Run from your application root with this npm-style node_modules layout.
# Set this to the absolute path of the downloaded patch.
SUBMIT_PATCH=/absolute/path/to/patches/form-core-1.33.5.patch
git apply --check --directory=node_modules/@tanstack/form-core "$SUBMIT_PATCH"
git apply --directory=node_modules/@tanstack/form-core "$SUBMIT_PATCH"
```

Directly editing `node_modules` is temporary and will be lost on reinstall. Save it as a dependency patch before relying on it in your application. Use the included comparison directory separately from your application's patched installation, because its checks deliberately require an untouched original dependency.

```jsx
const form = useForm({
  defaultValues: { a: '', b: '' },
  canSubmitWhenInvalid: true,
  validators: {
    onSubmit: ({ value }) => {
      const fields = {}
      if (!value.a) fields.a = 'Name is required'
      if (!value.b) fields.b = 'Detail is required'
      return Object.keys(fields).length ? { fields } : undefined
    },
  },
  onSubmit: async ({ value }) => {
    await saveValues(value)
  },
})
```

Keep the usual `form.handleSubmit()` path. `canSubmitWhenInvalid` permits attempting validation; the patch does **not** permit saving invalid values. It does not clear errors indiscriminately or call application submission handlers directly. Each admitted submission runs the field stage and form stage once; existing dynamic/change/blur strategies can also run validators on their own events.

## Scope and evidence

The mounted-field tests cover repeated submissions, mixed `onSubmit` and `onDynamic` rules, `revalidateLogic`, stale form blur errors, controlled asynchronous field/form validators, same-field error priority, whole-form errors, invalid callbacks, metadata and successful submission listeners. They run against compiled TypeScript source and the distributed ESM/CommonJS entry points. The default and false settings retain their original field-error gate.

Software-operated Chrome checks additionally reproduced the original repeated/mixed failures and completed both corrected workflows in the React demo: empty errors, correct saved values and one successful save. This is not human manual validation, React Native validation or confirmation from the original reporters.

The patch is version-specific and not an official release. It does not change exception/cancellation handling, submission concurrency or form-group submission behavior. Async validators still follow TanStack Form's existing `asyncAlways` rules. Review and test your application's validators before adopting it; running form validation after a field failure may perform work that your form previously skipped.

[Upstream PR #2260](https://github.com/TanStack/form/pull/2260) addresses the stale form-only error gate by examining fresh field errors. Its proposed flow still stops on a field-validation error. This example also covers the mixed-validation workflow, explicitly opted in through the existing option. Check upstream changes before applying this patch to a later version.

The example is MIT licensed. TanStack Form's copyright and MIT notice are included in [UPSTREAM-LICENSE](UPSTREAM-LICENSE); the patch contains portions of its source.

## Optional coffee

The patch and example are free. If they save you some time, a small coffee is welcome, entirely optional:

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
