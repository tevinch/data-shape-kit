import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { prepare, checkOriginal } from './prepare.mjs';

const mode = process.argv[2]?.replace(/^--/, '');
if (!['original', 'patched'].includes(mode)) throw Error('Use --original or --patched');
const prepared = await prepare(mode);
const { temporary, packageRoot } = prepared;
const records = [];

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(api, options = {}) {
  const events = { form: 0, field: 0, invalid: 0, saves: [], listeners: 0, fieldListeners: 0 };
  const validate = ({ value }) => {
    events.form++;
    const fields = {};
    if (!value.a) fields.a = 'form: a required';
    if (!value.b) fields.b = 'form: b required';
    return Object.keys(fields).length ? { fields } : undefined;
  };
  const form = new api.FormApi({
    defaultValues: { a: '', b: '' },
    canSubmitWhenInvalid: true,
    validators: { onSubmit: validate },
    onSubmit: ({ value, meta }) => events.saves.push({ value: { ...value }, meta }),
    onSubmitInvalid: () => events.invalid++,
    listeners: { onSubmit: () => events.listeners++ },
    ...options.form?.(events, validate),
  });
  const disposeForm = form.mount();
  const a = new api.FieldApi({ form, name: 'a', listeners: { onSubmit: () => events.fieldListeners++ }, ...options.a?.(events) });
  const b = new api.FieldApi({ form, name: 'b', listeners: { onSubmit: () => events.fieldListeners++ } });
  const disposeA = a.mount(), disposeB = b.mount();
  assert.equal(Object.values(form.fieldInfo).filter(info => info.instance).length, 2, 'both actual fields are mounted');
  return { form, a, b, events, dispose() { disposeB(); disposeA(); disposeForm(); } };
}

async function repeated(api) {
  const f = fixture(api);
  try {
    f.a.handleChange('first');
    await f.form.handleSubmit();
    assert.deepEqual(f.b.state.meta.errors, ['form: b required']);
    f.a.handleChange('');
    await f.form.handleSubmit();
    assert.deepEqual(f.a.state.meta.errors, ['form: a required'], 'second submit reports newly empty a');
    assert.deepEqual(f.b.state.meta.errors, ['form: b required']);
    assert.equal(f.events.form, 2);
    assert.equal(f.events.invalid, 2);
    f.a.handleChange('Alice'); f.b.handleChange('ready');
    await f.form.handleSubmit({ id: 'repeated' });
    assert.deepEqual(f.events.saves, [{ value: { a: 'Alice', b: 'ready' }, meta: { id: 'repeated' } }]);
    assert.equal(f.events.form, 3);
    assert.equal(f.form.state.isSubmitSuccessful, true);
    assert.deepEqual(f.a.state.meta.errors, []);
    assert.deepEqual(f.b.state.meta.errors, []);
  } finally { f.dispose(); }
}

async function mixed(api, dynamic = false) {
  const cause = dynamic ? 'onDynamic' : 'onSubmit';
  const f = fixture(api, {
    form: (_, validate) => ({ validators: { [cause]: validate }, ...(dynamic ? { validationLogic: api.revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }) } : {}) }),
    a: events => ({ validators: { [cause]: ({ value }) => { events.field++; return value ? undefined : 'field: a required'; } } }),
  });
  try {
    await f.form.handleSubmit();
    assert.equal(f.events.field, 1, 'field validator executed');
    assert.equal(f.events.form, 1, 'form validator executed despite field error');
    assert.deepEqual(f.a.state.meta.errors, ['field: a required'], 'field error retains precedence');
    assert.deepEqual(f.b.state.meta.errors, ['form: b required']);
    assert.equal(f.events.invalid, 1);
    assert.equal(f.events.saves.length, 0);
    f.a.handleChange('Alice');
    await f.form.handleSubmit();
    assert.deepEqual(f.a.state.meta.errors, []);
    assert.deepEqual(f.b.state.meta.errors, ['form: b required']);
    f.b.handleChange('ready');
    const before = { field: f.events.field, form: f.events.form };
    await f.form.handleSubmit();
    assert.equal(f.events.field, before.field + 1);
    assert.equal(f.events.form, before.form + 1, 'one form pass in successful submit');
    assert.deepEqual(f.events.saves, [{ value: { a: 'Alice', b: 'ready' }, meta: undefined }]);
    assert.equal(f.events.invalid, 2);
    assert.equal(f.form.state.isSubmitting, false);
  } finally { f.dispose(); }
}

async function staleBlur(api) {
  const f = fixture(api, { form: (_, validate) => ({ validators: { onBlur: validate, onChange: validate, onSubmit: validate } }) });
  try {
    f.a.handleChange('alice@example.test');
    f.a.handleBlur();
    assert.equal(f.b.state.meta.errorMap.onBlur, 'form: b required', 'actual blur wrote stale bucket');
    f.b.handleChange('password');
    assert.equal(f.b.state.meta.errorMap.onBlur, 'form: b required', 'change does not refresh blur bucket');
    await f.form.handleSubmit();
    assert.deepEqual(f.events.saves, [{ value: { a: 'alice@example.test', b: 'password' }, meta: undefined }], 'first completed submit saves current values');
    assert.equal(f.events.invalid, 0);
    assert.equal(f.b.state.meta.errorMap.onBlur, undefined);
  } finally { f.dispose(); }
}

async function asyncMixed(api) {
  const fieldGate = deferred(), formGate = deferred(), formStarted = deferred();
  let pending;
  const f = fixture(api, {
    a: events => ({ validators: { onSubmitAsync: async ({ value }) => { events.field++; await fieldGate.promise; return value ? undefined : 'async: a required'; } } }),
    form: (events) => ({ validators: { onSubmitAsync: async ({ value }) => { events.form++; formStarted.resolve('started'); await formGate.promise; const fields = {}; if (!value.a) fields.a = 'form async: a required'; if (!value.b) fields.b = 'async: b required'; return Object.keys(fields).length ? { fields } : undefined; } } }),
  });
  try {
    pending = f.form.handleSubmit();
    assert.equal(f.form.state.isSubmitting, true);
    assert.equal(f.events.invalid, 0);
    fieldGate.resolve();
    const phase = await Promise.race([formStarted.promise, pending.then(() => 'ended before form')]);
    assert.equal(phase, 'started', 'form async validator must run after invalid field async validator');
    assert.equal(f.events.field, 1);
    assert.equal(f.events.form, 1);
    assert.equal(f.form.state.isSubmitting, true, 'submission waits for form validator');
    assert.equal(f.events.invalid, 0);
    formGate.resolve();
    await pending;
    assert.deepEqual(f.a.state.meta.errors, ['async: a required']);
    assert.deepEqual(f.b.state.meta.errors, ['async: b required']);
    assert.equal(f.events.invalid, 1);
    f.a.handleChange('Alice'); f.b.handleChange('ready');
    await f.form.handleSubmit();
    assert.equal(f.events.field, 2);
    assert.equal(f.events.form, 2);
    assert.equal(f.events.saves.length, 1);
    assert.deepEqual(f.events.saves[0].value, { a: 'Alice', b: 'ready' });
    assert.equal(f.form.state.isSubmitSuccessful, true);
    assert.equal(f.form.state.isSubmitting, false);
  } finally { fieldGate.resolve(); formGate.resolve(); await pending; f.dispose(); }
}

async function defaultGate(api, option) {
  const f = fixture(api, { form: () => ({ canSubmitWhenInvalid: option }), a: events => ({ validators: { onSubmit: () => { events.field++; return 'field failure'; } } }) });
  try {
    await f.form.handleSubmit();
    assert.equal(f.events.field, 1);
    assert.equal(f.events.form, 0, 'default/false preserves early field gate');
    assert.equal(f.events.invalid, 1);
    assert.deepEqual(f.b.state.meta.errors, []);
    assert.equal(f.events.saves.length, 0);
  } finally { f.dispose(); }
}

async function scalarError(api) {
  let invalid = true;
  const f = fixture(api, { form: events => ({ validators: { onSubmit: () => { events.form++; return invalid ? 'whole form invalid' : undefined; } } }) });
  try {
    await f.form.handleSubmit();
    assert.equal(f.events.saves.length, 0);
    assert.ok(f.form.state.errors.includes('whole form invalid'));
    invalid = false;
    await f.form.handleSubmit();
    assert.equal(f.events.form, 2);
    assert.equal(f.events.saves.length, 1);
    assert.equal(f.events.invalid, 1);
  } finally { f.dispose(); }
}

async function successListeners(api) {
  const save = deferred();
  const f = fixture(api, { form: events => ({ defaultValues: { a: 'Alice', b: 'ready' }, onSubmit: async ({ value, meta }) => { events.saves.push({ value: { ...value }, meta }); await save.promise; } }) });
  let pending;
  try {
    pending = f.form.handleSubmit({ action: 'save' });
    for (let attempt = 0; !f.events.saves.length && attempt < 100; attempt++) await new Promise(done => setImmediate(done));
    assert.equal(f.events.saves.length, 1, 'save handler actually started');
    assert.equal(f.form.state.isSubmitting, true);
    assert.equal(f.events.form, 1);
    assert.equal(f.events.listeners, 1);
    assert.equal(f.events.fieldListeners, 2);
    assert.deepEqual(f.events.saves, [{ value: { a: 'Alice', b: 'ready' }, meta: { action: 'save' } }]);
    save.resolve(); await pending;
    assert.equal(f.form.state.isSubmitting, false);
    assert.equal(f.form.state.isSubmitSuccessful, true);
  } finally { save.resolve(); await pending; f.dispose(); }
}

const scenarios = [
  ['repeated form-only submit and actual save', repeated],
  ['mixed submit, field precedence and actual save', api => mixed(api)],
  ['dynamic mixed submit and subsequent changes', api => mixed(api, true)],
  ['stale form blur bucket and first-press save', staleBlur],
  ['async mixed validation waits and saves', asyncMixed],
  ['false option retains field gate', api => defaultGate(api, false)],
  ['unspecified option retains field gate', api => defaultGate(api, undefined)],
  ['whole-form scalar error still blocks saving', scalarError],
  ['valid save, metadata and listeners exactly once', successListeners],
];

try {
  const sourcePath = join(temporary, 'source.mjs');
  await build({ entryPoints: [join(packageRoot, 'src/index.ts')], outfile: sourcePath, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
  const require = createRequire(import.meta.url);
  const runtimes = [
    ['source', await import(pathToFileURL(sourcePath).href)],
    ['ESM', await import(pathToFileURL(join(packageRoot, 'dist/esm/index.js')).href)],
    ['CommonJS', require(join(packageRoot, 'dist/cjs/index.cjs'))],
  ];
  for (const [runtime, api] of runtimes) for (const [name, scenario] of scenarios) {
    try { await scenario(api); records.push({ runtime, name, passed: true }); }
    catch (error) { records.push({ runtime, name, passed: false, message: error.message }); }
  }
} finally { await rm(temporary, { recursive: true, force: true }); await checkOriginal(); }
for (const record of records) console.log(`${record.passed ? 'ok' : 'FAIL'} ${record.runtime}: ${record.name}${record.message ? ' — ' + record.message.split('\n')[0] : ''}`);
const failed = records.filter(record => !record.passed).length;
console.log(JSON.stringify({ mode, total: records.length, passed: records.length - failed, failed }));
if (failed) process.exitCode = 1;
