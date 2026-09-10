import assert from 'node:assert/strict';
import test from 'node:test';

import { createColumnProjector } from './column-map.mjs';
import { selectCsvColumns } from './papaparse-columns.mjs';

test('selects source positions and renames their output properties', () => {
  const project = createColumnProjector(
    ['Code Set', 'Unused', 'Code Name', 'Code Value'],
    { 'Code Set': 'codeSet', 'Code Name': 'codeName', 'Code Value': 'codeValue' },
  );

  assert.deepEqual(project(['001', 'x', 'Alpha', 'NA']), {
    codeSet: '001',
    codeName: 'Alpha',
    codeValue: 'NA',
  });
});

test('follows mapping enumeration order while dropping unselected columns', () => {
  const mapping = {};
  mapping['10'] = 'ten';
  mapping['2'] = 'two';
  mapping.label = 'name';
  const project = createColumnProjector(['10', 'ignored', '2', 'label', 'tail'], mapping);

  assert.deepEqual(Object.keys(project(['a', 'b', 'c', 'd', 'e'])), ['two', 'ten', 'name']);
  assert.deepEqual(project(['a', 'b', 'c', 'd', 'e']), {
    two: 'c',
    ten: 'a',
    name: 'd',
  });
});

test('preserves cell values and returns a fresh normal plain object without mutation', () => {
  const headers = ['empty', 'nil', 'flag', 'count', 'identifier'];
  const row = ['', null, false, 0, '001'];
  const project = createColumnProjector(headers, {
    empty: 'empty',
    nil: 'nil',
    flag: 'flag',
    count: 'count',
    identifier: 'identifier',
  });

  const first = project(row);
  const second = project(row);

  assert.deepEqual(first, { empty: '', nil: null, flag: false, count: 0, identifier: '001' });
  assert.notStrictEqual(first, second);
  assert.equal(Object.getPrototypeOf(first), Object.prototype);
  assert.deepEqual(headers, ['empty', 'nil', 'flag', 'count', 'identifier']);
  assert.deepEqual(row, ['', null, false, 0, '001']);
});

test('captures the header positions and mapping names at construction', () => {
  const headers = ['source', 'other'];
  const mapping = Object.assign(Object.create(null), { source: 'captured' });
  const project = createColumnProjector(headers, mapping);

  headers[0] = 'changed';
  mapping.source = 'changed';
  mapping.other = 'added';

  assert.deepEqual(project(['kept', 'ignored']), { captured: 'kept' });
});

test('requires each selected header to exist exactly once', () => {
  assert.throws(
    () => createColumnProjector(['first', 'second'], { missing: 'value' }),
    /missing.*not found/i,
  );
  assert.throws(
    () => createColumnProjector(['same', 'same'], { same: 'value' }),
    /same.*ambiguous/i,
  );

  const project = createColumnProjector(['keep', 'duplicate', 'duplicate'], { keep: 'value' });
  assert.deepEqual(project(['yes', 'left', 'right']), { value: 'yes' });
});

test('rejects duplicate destination names', () => {
  assert.throws(
    () => createColumnProjector(['first', 'second'], { first: 'same', second: 'same' }),
    { name: 'TypeError', message: /destination.*same.*unique/i },
  );
});

test('rejects invalid header arrays', async (t) => {
  const sparse = [];
  sparse.length = 1;
  const cases = [
    { name: 'not an array', headers: 'name' },
    { name: 'empty', headers: [] },
    { name: 'sparse', headers: sparse },
    { name: 'non-string entry', headers: ['name', 2] },
  ];

  for (const { name, headers } of cases) {
    await t.test(name, () => {
      assert.throws(
        () => createColumnProjector(headers, { name: 'value' }),
        { name: 'TypeError', message: /headers/i },
      );
    });
  }
});

test('rejects invalid mappings and destination names', async (t) => {
  class Mapping {
    source = 'value';
  }

  const cases = [
    { name: 'undefined', mapping: undefined, message: /mapping.*plain object/i },
    { name: 'null', mapping: null, message: /mapping.*plain object/i },
    { name: 'array', mapping: [], message: /mapping.*plain object/i },
    { name: 'custom prototype', mapping: new Mapping(), message: /mapping.*plain object/i },
    { name: 'empty object', mapping: {}, message: /mapping.*at least one/i },
    { name: 'only nonenumerable entry', mapping: Object.defineProperty({}, 'source', { value: 'value' }), message: /mapping.*at least one/i },
    { name: 'only symbol entry', mapping: { [Symbol('source')]: 'value' }, message: /mapping.*at least one/i },
    { name: 'non-string name', mapping: { source: 1 }, message: /destination.*nonempty string/i },
    { name: 'empty name', mapping: { source: '' }, message: /destination.*nonempty string/i },
  ];

  for (const { name, mapping, message } of cases) {
    await t.test(name, () => {
      assert.throws(
        () => createColumnProjector(['source'], mapping),
        { name: 'TypeError', message },
      );
    });
  }
});

test('rejects arrays even when their prototype is changed to null', () => {
  const mapping = Object.setPrototypeOf(['value'], null);

  assert.throws(
    () => createColumnProjector(['source'], mapping),
    { name: 'TypeError', message: /mapping.*plain object/i },
  );
});

test('validates every projected row against the captured rectangular schema', async (t) => {
  const project = createColumnProjector(['first', 'second'], { first: 'value' });
  const sparse = ['kept'];
  sparse.length = 2;
  const cases = [
    { name: 'not an array', row: { 0: 'kept', 1: 'ignored' }, error: TypeError, message: /row.*array/i },
    { name: 'short', row: ['kept'], error: Error, message: /row.*width.*2.*1/i },
    { name: 'long', row: ['kept', 'ignored', 'extra'], error: Error, message: /row.*width.*2.*3/i },
    { name: 'sparse', row: sparse, error: TypeError, message: /row.*dense/i },
  ];

  for (const { name, row, error, message } of cases) {
    await t.test(name, () => {
      assert.throws(() => project(row), { name: error.name, message });
    });
  }
});

test('matches blank and whitespace headers literally and safely creates special properties', () => {
  const project = createColumnProjector(
    ['', ' ', '__proto__', 'constructor', 'toString'],
    {
      '': 'blank',
      ' ': 'space',
      ['__proto__']: '__proto__',
      constructor: 'constructor',
      toString: 'toString',
    },
  );

  const result = project(['empty', 'whitespace', 'proto value', 'ctor value', 'method value']);

  assert.deepEqual(result, {
    blank: 'empty',
    space: 'whitespace',
    ['__proto__']: 'proto value',
    constructor: 'ctor value',
    toString: 'method value',
  });
  assert.equal(Object.hasOwn(result, '__proto__'), true);
});

test('parses CSV array rows before selecting and renaming source columns', () => {
  assert.deepEqual(
    selectCsvColumns(
      'Code Set,Unused,Code Name\r\n001,x,"A,B"',
      { 'Code Set': 'id', 'Code Name': 'name' },
    ),
    [{ id: '001', name: 'A,B' }],
  );
});

test('preserves quoted text, CRLF, BOM handling, empty cells, and identifier strings', () => {
  const csv = '\uFEFFCode Set,Unused,Code Name,Code Value\r\n'
    + '001,x,"A,B",\r\n'
    + '002,y,"Line one\r\nLine two","said ""hello"""\r\n'
    + ',z,Blank,false\r\n';

  assert.deepEqual(
    selectCsvColumns(csv, {
      'Code Set': 'id',
      'Code Name': 'name',
      'Code Value': 'value',
    }),
    [
      { id: '001', name: 'A,B', value: '' },
      { id: '002', name: 'Line one\r\nLine two', value: 'said "hello"' },
      { id: '', name: 'Blank', value: 'false' },
    ],
  );
});

test('uses a caller-supplied delimiter and never auto-detects another one', () => {
  assert.deepEqual(
    selectCsvColumns('left;unused;right\n01;x;value', { left: 'id', right: 'name' }, { delimiter: ';' }),
    [{ id: '01', name: 'value' }],
  );
  assert.deepEqual(
    selectCsvColumns('left;right\nA;B', { 'left;right': 'raw' }),
    [{ raw: 'A;B' }],
  );
});

test('returns no rows for a header-only CSV', () => {
  assert.deepEqual(selectCsvColumns('id,name\r\n', { id: 'id' }), []);
});

test('skips completely empty records but retains whitespace and delimiter-only records', () => {
  assert.deepEqual(
    selectCsvColumns('first,second\n\n   ,value\n,\n\n', { first: 'first', second: 'second' }),
    [
      { first: '   ', second: 'value' },
      { first: '', second: '' },
    ],
  );
});

test('requires at least one parsed header record', async (t) => {
  for (const [name, csv] of [
    ['empty string', ''],
    ['LF-only records', '\n\n'],
    ['BOM only', '\uFEFF'],
  ]) {
    await t.test(name, () => {
      assert.throws(
        () => selectCsvColumns(csv, { id: 'id' }),
        { name: 'Error', message: /header record/i },
      );
    });
  }
});

test('rejects PapaParse errors with their code and message before validating the mapping', () => {
  assert.throws(
    () => selectCsvColumns('name,value\n"unterminated', { missing: 'result' }),
    (error) => {
      assert.equal(error.code, 'MissingQuotes');
      assert.match(error.message, /MissingQuotes.*Quoted field unterminated/i);
      return true;
    },
  );
});

test('adds parsed data row numbers to short and long row errors', async (t) => {
  const cases = [
    { name: 'short first data row', csv: 'first,second\n\nonly-one\n', width: 1 },
    { name: 'long second data row', csv: 'first,second\nok,row\nextra,values,here\n', width: 3 },
  ];

  for (const { name, csv, width } of cases) {
    await t.test(name, () => {
      const expectedRow = name.startsWith('short') ? 1 : 2;
      assert.throws(
        () => selectCsvColumns(csv, { first: 'value' }),
        { name: 'Error', message: new RegExp(`data row ${expectedRow}.*width.*2.*${width}`, 'i') },
      );
    });
  }
});

test('rejects non-string CSV values and invalid option containers', async (t) => {
  for (const [name, csv] of [
    ['null', null],
    ['buffer', Buffer.from('id\n1')],
    ['boxed string', new String('id\n1')],
  ]) {
    await t.test(`CSV ${name}`, () => {
      assert.throws(
        () => selectCsvColumns(csv, { id: 'id' }),
        { name: 'TypeError', message: /csv.*string/i },
      );
    });
  }

  for (const [name, options] of [
    ['null', null],
    ['array', []],
    ['string', ','],
  ]) {
    await t.test(`options ${name}`, () => {
      assert.throws(
        () => selectCsvColumns('id\n1', { id: 'id' }, options),
        { name: 'TypeError', message: /options.*object/i },
      );
    });
  }
});

test('rejects empty, non-string, and PapaParse-forbidden delimiters', async (t) => {
  const cases = [
    { name: 'empty', delimiter: '' },
    { name: 'number', delimiter: 1 },
    { name: 'carriage return', delimiter: '\r' },
    { name: 'line feed within text', delimiter: ';\n' },
    { name: 'double quote', delimiter: '"' },
    { name: 'BOM', delimiter: '\uFEFF' },
  ];

  for (const { name, delimiter } of cases) {
    await t.test(name, () => {
      assert.throws(
        () => selectCsvColumns('id\n1', { id: 'id' }, { delimiter }),
        { name: 'TypeError', message: /delimiter/i },
      );
    });
  }
});

test('ignores unrecognized adapter options instead of forwarding them to PapaParse', () => {
  assert.deepEqual(
    selectCsvColumns('id,unused\n001,x', { id: 'id' }, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: false,
      transform: () => 'changed',
      worker: true,
    }),
    [{ id: '001' }],
  );
});
