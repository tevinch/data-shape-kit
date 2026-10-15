const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const moduleName = args.find((arg) => !arg.startsWith('--')) || 'lightningcss';
const modulePath = require.resolve(moduleName);
const {transform} = require(modulePath);
const code = readFileSync(path.join(__dirname, 'a.css'));
const options = {filename: 'a.css', code, errorRecovery: true, minify: true};
const result = transform(options);
const output = result.code.toString();
const expected = '.a{color:red;width:1px;height:2px}';
const expectedWarnings = [{
  message: 'Unknown at rule: @keyframes',
  type: 'AtRuleInvalid',
  value: 'keyframes',
  loc: {filename: 'a.css', line: 1, column: 36}
}];

let strictError;
try {
  transform({...options, errorRecovery: false});
} catch (error) {
  strictError = {name: error.name, message: error.message};
}

console.log(JSON.stringify({
  modulePath,
  input: code.toString(),
  options: {errorRecovery: true, minify: true},
  output,
  warnings: result.warnings,
  strictError,
  declarationsPreserved: output === expected
}, null, 2));

assert.deepEqual(result.warnings, expectedWarnings);
assert.ok(strictError, 'Strict parsing must reject the invalid nested at-rule');
assert.equal(strictError.message, 'Unknown at rule: @keyframes');
if (args.includes('--expect-preserved')) {
  assert.equal(output, expected, 'Valid declarations before the invalid rule were lost');
}
