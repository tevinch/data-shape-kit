import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClipboard, formatClipboard, toRecords, ClipboardTableError } from './index.mjs';

const fixtures = [
  ['empty input', '', []],
  ['BOM only', '\uFEFF', []],
  ['plain grid', 'id\tname\n001\tAda', [['id','name'],['001','Ada']]],
  ['CRLF record terminator', 'a\tb\r\nc\td\r\n', [['a','b'],['c','d']]],
  ['CR record terminator', 'a\rb\r', [['a'],['b']]],
  ['embedded LF', '1\t"first\nsecond"\r\n', [['1','first\nsecond']]],
  ['embedded CRLF and CR', '"first\r\nsecond\rthird"\tx', [['first\r\nsecond\rthird','x']]],
  ['escaped consecutive quotes', '"a""""b"\t"""hi"""', [['a""b','"hi"']]],
  ['embedded tab', '"a\tb"\tx', [['a\tb','x']]],
  ['trailing empty columns', 'a\t\t\n', [['a','','']]],
  ['interior blank record', 'a\n\nb', [['a'],[''],['b']]],
  ['explicit final blank record', 'a\n\n', [['a'],['']]],
  ['one blank record', '\n', [['']]],
  ['one empty quoted cell', '""', [['']]],
  ['whitespace preserved', ' 001 \t\u00a0\t ', [[' 001 ','\u00a0',' ']]],
  ['no type coercion', '00123\t9007199254740993\ttrue\t2026-09-09', [['00123','9007199254740993','true','2026-09-09']]],
  ['Unicode and initial BOM', '\uFEFF编号\t名字\n００１\t茶☕', [['编号','名字'],['００１','茶☕']]],
  ['literal quote in unquoted text', 'say "hello"\t6" ruler', [['say "hello"','6" ruler']]],
  ['formula text stays text in memory', '=1+1\t+12\t@A1', [['=1+1','+12','@A1']]],
];
for (const [name,input,expected] of fixtures) {
  test(`parse: ${name}`,()=>assert.deepEqual(parseClipboard(input),expected));
}
test('unclosed field reports coordinates without source values',()=>{
  assert.throws(()=>parseClipboard('id\tnote\n1\t"private sample'),error=>{
    assert.ok(error instanceof ClipboardTableError);
    assert.equal(error.code,'UNCLOSED_QUOTE');
    assert.equal(error.row,2); assert.equal(error.column,2);
    assert.equal(error.offset,25);
    assert.ok(!error.message.includes('private sample')); return true;
  });
});
test('unexpected content after a closing quote is rejected',()=>{
  assert.throws(()=>parseClipboard('"abc"xyz'),e=>e.code==='UNEXPECTED_CHARACTER' && e.offset===5);
});
test('limits accept exact bounds and reject one more item',()=>{
  assert.deepEqual(parseClipboard('a\tb\nc\td\n',{maxChars:8,maxRows:2,maxColumns:2}),[['a','b'],['c','d']]);
  for(const [text,options,code] of [
    ['abcd',{maxChars:3},'MAX_CHARS'],
    ['a\nb',{maxRows:1},'MAX_ROWS'],
    ['a\t',{maxColumns:1},'MAX_COLUMNS'],
  ]) assert.throws(()=>parseClipboard(text,options),e=>e.code===code);
});
test('invalid inputs and limits do not silently succeed',()=>{
  for(const value of [null,2,{},[]]) assert.throws(()=>parseClipboard(value),TypeError);
  for(const options of [null,[],{maxRows:0},{maxColumns:1.5},{maxChars:NaN},{maxRows:Infinity},{typo:1}]) {
    assert.throws(()=>parseClipboard('a',options),TypeError);
  }
});
test('format uses quoted fields, doubles quotes and CRLF records',()=>{
  assert.equal(formatClipboard([['id','note'],['001','two\nlines'],['2','say "hi"']]),'id\tnote\r\n001\t"two\nlines"\r\n2\t"say ""hi"""');
});
test('format distinguishes no records from an empty cell and preserves a leading BOM cell',()=>{
  assert.equal(formatClipboard([]),'');
  assert.equal(formatClipboard([['']]),'""');
  assert.equal(formatClipboard([['\uFEFFid']]),'"\uFEFFid"');
});
test('format never coerces cells, sparse arrays, or invalid rows',()=>{
  for(const value of [null,{},'text',[[]],[[1]],[[null]],[Array(1)],Array(1)]) {
    assert.throws(()=>formatClipboard(value),TypeError);
  }
});
test('deterministic round trips cover small grids with delimiter and quote combinations',()=>{
  const cells=['','a','001','\t','\n','\r\n','"','""',' x ','茶☕','\uFEFFx','=1+1'];
  for(let a=0;a<cells.length;a++) for(let b=0;b<cells.length;b++) {
    const rows=[[cells[a],cells[b]],[cells[(a+b)%cells.length],'']];
    assert.deepEqual(parseClipboard(formatClipboard(rows)),rows);
  }
  assert.deepEqual(parseClipboard(formatClipboard([['a'],['']])),[['a'],['']]);
});
test('records retain exact headers and values',()=>{
  const rows=[[' SKU ','name'],['001','Tea'],['002','']];
  assert.deepEqual(toRecords(rows),[{' SKU ':'001',name:'Tea'},{' SKU ':'002',name:''}]);
  assert.deepEqual(rows,[[' SKU ','name'],['001','Tea'],['002','']]);
  assert.deepEqual(toRecords([]),[]);
  assert.deepEqual(toRecords([['id']]),[]);
});
test('records reject duplicate or blank headers and ragged rows',()=>{
  for(const [rows,code] of [
    [[['id','id'],['1','2']],'DUPLICATE_HEADER'],
    [[['id',' ']],'EMPTY_HEADER'],
    [[['id','name'],['1']],'RAGGED_ROW'],
    [[['id'],['1','2']],'RAGGED_ROW'],
  ]) assert.throws(()=>toRecords(rows),e=>e instanceof ClipboardTableError && e.code===code);
});
test('records support special header names as own data properties',()=>{
  const [record]=toRecords([['__proto__','constructor','toString'],['value','ctor','text']]);
  assert.equal(Object.getPrototypeOf(record),Object.prototype);
  assert.ok(Object.hasOwn(record,'__proto__'));
  assert.equal(record.__proto__,'value');
  assert.equal(record.constructor,'ctor'); assert.equal(record.toString,'text');
});
test('records reject non-string cells and sparse rows',()=>{
  for(const value of [null,{},[[]],[['id'],[42]],[['id'],Array(1)]]) assert.throws(()=>toRecords(value),TypeError);
});
