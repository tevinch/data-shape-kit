import {registerTableEdgeInput} from './table-edge-input.js';

export const fixture = (first = 'Test', second = '&nbsp;', third = '&nbsp;', cell = 'td') => `<table style="border-collapse:collapse;width:100%"><tbody><tr><${cell} style="border:1px solid #aab4bf;width:33.333%;height:24px">${first}</${cell}><td style="border:1px solid #aab4bf;width:33.333%">${second}</td><td style="border:1px solid #aab4bf;width:33.333%">${third}</td></tr></tbody></table>`;
const point = (node, offset) => ({node, offset});
const rangePoints = r => [point(r.startContainer, r.startOffset), point(r.endContainer, r.endOffset)];
const sameRange = (a, b) => a.every((v, i) => v.node === b[i].node && v.offset === b[i].offset);
const assert = (ok, message) => {if (!ok) throw Error(message);};
const textNode = (ed, el) => ed.getDoc().createTreeWalker(el, 4).nextNode();
const texts = ed => Array.from(ed.getBody().querySelectorAll('td,th'), c => c.textContent.replaceAll('\u00a0', ''));

export function edgeRange(ed, offset) {
  const table = ed.getBody().querySelector('table');
  const text = textNode(ed, table.rows[0].cells[0]);
  const range = ed.getDoc().createRange();
  range.setStartBefore(table);
  range.setEnd(text, offset ?? text.length);
  ed.focus();
  ed.selection.setRng(range, false);
}

export async function runChecks(ed, report) {
  const results = [];
  let dispose = registerTableEdgeInput(ed);
  let beforeCount = 0, inputCount = 0;
  const countBefore = () => {beforeCount++;};
  const countInput = () => {inputCount++;};
  ed.on('beforeinput', countBefore);
  ed.on('input', countInput);
  const reset = (html = fixture()) => {ed.mode.set('design');ed.setContent(html);ed.undoManager.clear();ed.undoManager.add();};
  const dispatch = (options = {}) => {
    const event = new (ed.getWin().InputEvent)('beforeinput', {bubbles:true,cancelable:true,inputType:'insertText',data:'s',...options});
    const count = beforeCount;
    const allowed = ed.getBody().dispatchEvent(event);
    assert(beforeCount > count, 'required beforeinput listener did not run');
    return allowed;
  };
  const replace = (options = {}) => {
    const count = inputCount;
    const allowed = dispatch(options);
    if (allowed) {
      ed.getDoc().execCommand('insertText', false, options.data ?? 's');
      assert(inputCount > count, 'required input event did not run');
    }
    return allowed;
  };
  const check = async (name, action) => {
    try {await action();results.push({name,passed:true});}
    catch(e){results.push({name,passed:false,error:e.message});}
    report({total:results.length,passed:results.filter(r=>r.passed).length,results,beforeCount,inputCount});
  };
  const wantCells = (want) => assert(JSON.stringify(texts(ed)) === JSON.stringify(want), `cells ${JSON.stringify(texts(ed))}; expected ${JSON.stringify(want)}`);
  try {
    for (const [name, html, offset, expected] of [
      ['leading edge preserves three empty-cell structure', fixture(),undefined,['s','','']],
      ['other cell content survives',fixture('Test','Keep two','Keep three'),undefined,['s','Keep two','Keep three']],
      ['partial prefix leaves remaining text',fixture('Testing','Two','Three'),4,['sing','Two','Three']],
      ['formatted first cell survives',fixture('<strong>Test</strong>','Two','Three'),undefined,['s','Two','Three']],
      ['header cell supports replacement',fixture('Test','Two','Three','th'),undefined,['s','Two','Three']],
      ['surrounding paragraphs survive','<p>Before</p>'+fixture('Test','Two','Three')+'<p>After</p>',undefined,['s','Two','Three']],
    ]) await check(name,()=>{reset(html);edgeRange(ed,offset);replace();wantCells(expected);if(name.startsWith('surrounding'))assert(JSON.stringify(Array.from(ed.getBody().querySelectorAll(':scope > p'),p=>p.textContent))==='["Before","After"]','surrounding paragraphs changed');});

    await check('repeated replacement completes',()=>{reset();for (const value of ['a','b','c']){edgeRange(ed);replace({data:value});wantCells([value,'','']);}});
    await check('undo and redo preserve table',()=>{reset();edgeRange(ed);replace();ed.undoManager.add();wantCells(['s','','']);ed.undoManager.undo();wantCells(['Test','','']);ed.undoManager.redo();wantCells(['s','','']);});
    await check('contained-word selection remains unchanged',()=>{reset();const text=textNode(ed,ed.getBody().querySelector('td')),r=ed.getDoc().createRange();r.selectNodeContents(text);ed.selection.setRng(r);const before=rangePoints(ed.selection.getRng());dispatch();assert(sameRange(before,rangePoints(ed.selection.getRng())),'contained selection changed');ed.getDoc().execCommand('insertText',false,'s');wantCells(['s','','']);});
    await check('full-table selection still replaces the table',()=>{reset();const r=ed.getDoc().createRange();r.selectNode(ed.getBody().querySelector('table'));ed.focus();ed.selection.setRng(r);replace();assert(ed.getBody().querySelectorAll('table').length===0&&ed.getBody().textContent==='s','intentional whole-table replacement changed');});
    await check('host cancellation actually runs and prevents input',()=>{reset();edgeRange(ed);let canceled=0;const cancel=e=>{canceled++;e.preventDefault();};ed.on('beforeinput',cancel,true);try{const before=rangePoints(ed.selection.getRng());assert(!replace(),'cancelled event was allowed');assert(canceled===1,'host cancellation did not execute exactly once');assert(sameRange(before,rangePoints(ed.selection.getRng())),'cancelled selection changed');wantCells(['Test','','']);}finally{ed.off('beforeinput',cancel);}});
    for (const [name, prepare, options] of [
      ['composition delegates',()=>{reset();edgeRange(ed);},{isComposing:true}],
      ['paste delegates',()=>{reset();edgeRange(ed);},{inputType:'insertFromPaste'}],
      ['deletion delegates',()=>{reset();edgeRange(ed);},{inputType:'deleteContentBackward',data:null}],
      ['collapsed range delegates',()=>{reset();edgeRange(ed);ed.selection.collapse(false);},{}],
      ['readonly does not change selection or document',()=>{reset();edgeRange(ed);ed.mode.set('readonly');},{}],
      ['second cell boundary delegates',()=>{reset();const r=ed.getDoc().createRange(),table=ed.getBody().querySelector('table');r.setStartBefore(table);r.setEnd(table.rows[0].cells[1],0);ed.selection.setRng(r);},{}],
      ['caption content delegates',()=>{reset(fixture().replace('<tbody>','<caption>Keep caption</caption><tbody>'));edgeRange(ed);},{}],
      ['earlier footer content delegates',()=>{reset('<table><tfoot><tr><td>Keep footer</td></tr></tfoot><tbody><tr><td>Test</td></tr></tbody></table>');const table=ed.getBody().querySelector('table'),r=ed.getDoc().createRange();assert(table.firstElementChild.tagName==='TFOOT','fixture must preserve footer before body');r.setStartBefore(table);r.setEnd(table.querySelector('tbody td').firstChild,4);ed.selection.setRng(r);},{}],
      ['protected content in cell delegates',()=>{reset(fixture('Test<span contenteditable="false">Keep</span>'));edgeRange(ed);},{}],
      ['selection containing earlier paragraph delegates',()=>{reset('<p>Keep</p>'+fixture());const table=ed.getBody().querySelector('table'),r=ed.getDoc().createRange();r.setStart(ed.getBody().firstChild.firstChild,0);r.setEnd(table.rows[0].cells[0].firstChild,4);ed.selection.setRng(r);},{}],
      ['nested table delegates',()=>{reset(fixture(fixture()));const inner=ed.getBody().querySelector('table table'),r=ed.getDoc().createRange();r.setStartBefore(inner);r.setEnd(inner.rows[0].cells[0].firstChild,4);ed.selection.setRng(r);},{}],
    ]) await check(name,()=>{prepare();const before=rangePoints(ed.selection.getRng()),html=ed.getContent();dispatch(options);assert(sameRange(before,rangePoints(ed.selection.getRng())),'out-of-scope selection changed');assert(ed.getContent()===html,'out-of-scope document changed');});
    await check('disposal restores baseline failure',()=>{reset();dispose();dispose();try{edgeRange(ed);replace();assert(['<p>s</p>','s'].includes(ed.getContent()),'baseline result: '+ed.getContent());}finally{dispose=registerTableEdgeInput(ed);}});
    await check('registration after disposal works',()=>{reset();edgeRange(ed);replace();wantCells(['s','','']);});
  } finally {
    dispose();ed.off('beforeinput',countBefore);ed.off('input',countInput);reset();
  }
  return {total:results.length,passed:results.filter(r=>r.passed).length,results,beforeCount,inputCount};
}
