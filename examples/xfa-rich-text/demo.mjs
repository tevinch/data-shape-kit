// Copyright 2026 Tevinch. Apache-2.0; see LICENSE.
import * as pdfjs from './runtime/build/pdf.mjs';
import { EventBus, PDFViewer, PDFLinkService } from './runtime/web/pdf_viewer.mjs';
import { makePdf, richTextCases } from './fixtures.mjs';
import { runChecks } from './checks.mjs';

const original = new URLSearchParams(location.search).get('worker') === 'original';
pdfjs.GlobalWorkerOptions.workerSrc = original ? './runtime/build/pdf.worker.mjs' : './runtime/build/pdf.worker.xfa.mjs';
const options = {standardFontDataUrl:'./runtime/standard_fonts/', cMapUrl:'./runtime/cmaps/', cMapPacked:true, wasmUrl:'./runtime/wasm/'};
const status = document.querySelector('#status');
const sample = document.querySelector('#sample');
const report = document.querySelector('#report');
const buttons = [...document.querySelectorAll('button')];
document.querySelector('#mode').innerHTML = original
  ? 'Official 6.3.289 worker. <a href="./index.html">Use the repaired worker</a>.'
  : '6.3.289 with the XFA repair. <a href="?worker=original">Compare the official worker</a>.';
const eventBus = new EventBus();
const linkService = new PDFLinkService({eventBus});
const viewer = new PDFViewer({container:document.querySelector('#viewerContainer'), eventBus, linkService});
linkService.setViewer(viewer);
let task;
let currentDocument;
let currentBytes;

function busy(value) {
  sample.disabled = value;
  for (const button of buttons) button.disabled = value;
  if (!value && !currentDocument) {
    document.querySelector('#save').disabled = true;
    document.querySelector('#download').disabled = true;
  }
}

async function open(bytes) {
  viewer.setDocument(null);
  linkService.setDocument(null);
  currentDocument = null;
  if (task) await task.destroy();
  currentBytes = new Uint8Array(bytes);
  // PDF.js takes ownership of the supplied buffer. Keep separate retained bytes.
  task = pdfjs.getDocument({...options, data:new Uint8Array(bytes), enableXfa:true});
  currentDocument = await task.promise;
  const initialized = new Promise(resolve => {
    const done = () => { eventBus.off('pagesinit',done); resolve(); };
    eventBus.on('pagesinit',done);
  });
  linkService.setDocument(currentDocument);
  viewer.setDocument(currentDocument);
  await initialized;
  viewer.currentScale = 1;
  status.textContent = `Loaded ${currentDocument.numPages} pages. Edit the project note on page one.`;
}

async function act(callback) {
  busy(true);
  try { await callback(); }
  catch (error) { status.textContent = `Could not complete the operation: ${error.message}`; }
  finally { busy(false); }
}

async function reset() {
  const name = sample.value;
  await open(makePdf(richTextCases[name],{paragraphs:name==='paragraphs'}));
}

sample.addEventListener('change',()=>act(reset));
document.querySelector('#reset').addEventListener('click',()=>act(reset));
document.querySelector('#save').addEventListener('click',()=>act(async()=>{
  status.textContent = 'Saving and reopening…';
  const bytes = await currentDocument.saveDocument();
  await open(bytes);
  status.textContent = `Saved and reopened ${currentDocument.numPages} pages. The saved project note is shown below.`;
}));
document.querySelector('#download').addEventListener('click',()=>act(async()=>{
  const bytes = currentDocument.annotationStorage.size ? await currentDocument.saveDocument() : currentBytes;
  const url = URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link = document.createElement('a');
  link.href=url; link.download='xfa-rich-text.pdf'; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}));
document.querySelector('#checks').addEventListener('click',()=>act(async()=>{
  report.textContent='';
  const results=await runChecks(pdfjs,options,result=>{
    report.textContent += `${result.passed?'Passed':'Failed'}: ${result.name}${result.error?` — ${result.error}`:''}\n`;
  });
  status.textContent = `${results.filter(r=>r.passed).length}/${results.length} checks passed using ${original?'the official worker':'the repaired worker'}.`;
}));
await act(reset);
