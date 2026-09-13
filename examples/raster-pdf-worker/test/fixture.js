import { exportRasterPdf } from '../export-raster-pdf.js';
import { makeSamplePages } from '../sample-pages.js';

const optionsFor = s => ({ unit: 'px', format: s.landscape ? 'letter' : 'a4', orientation: s.landscape ? 'landscape' : 'portrait', hotfixes: ['px_scaling'], ...(s.encrypted ? { encryption: { userPassword: 'sample-view', ownerPassword: 'sample-owner', userPermissions: ['print'] } } : {}) });
const base64 = buffer => {
  const bytes = new Uint8Array(buffer); let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
const sameInputs = (pages, before) => pages.every((p, i) => typeof p.image === 'string' ? p.image === before[i] : p.image.length === before[i].length && p.image.every((b, j) => b === before[i][j]));
window.checks = {
  async warmup() { await exportRasterPdf(makeSamplePages(1)); },
  async exportOne(s) {
    const pages = makeSamplePages(s.pages, s);
    const before = pages.map(p => p.image.slice());
    const buffer = await exportRasterPdf(pages, optionsFor(s));
    return { workerHeader: new TextDecoder().decode(buffer.slice(0, 8)), workerBytes: buffer.byteLength, base64: base64(buffer), inputPreserved: sameInputs(pages, before) };
  },
  async retryAndParallel() {
    const pages = makeSamplePages(1, { byteArray: true });
    const before = pages.map(p => p.image.slice());
    let invalidImage = false, cancelled = false, customCancellation = false, timeout = false, cloneError = false;
    try { await exportRasterPdf([{ image: new Uint8Array([1, 2, 3]), format: 'PNG' }]); } catch (e) { invalidImage = /PNG|signature|buffer|offset|outside|length/i.test(e.message); }
    const aborter = new AbortController();
    const cancel = exportRasterPdf(pages, {}, { signal: aborter.signal });
    aborter.abort();
    try { await cancel; } catch (e) { cancelled = e.name === 'AbortError'; }
    const customAborter = new AbortController();
    const customCancel = exportRasterPdf(pages, {}, { signal: customAborter.signal });
    customAborter.abort(false);
    try { await customCancel; } catch (e) { customCancellation = e === false; }
    try { await exportRasterPdf(pages, {}, { timeoutMs: 1 }); } catch (e) { timeout = /timed out/.test(e.message); }
    try { await exportRasterPdf(pages, { extra: () => 1 }); } catch (e) { cloneError = e.name === 'DataCloneError'; }
    const retry = (await exportRasterPdf(pages)).byteLength > 1000;
    const parallel = (await Promise.all([exportRasterPdf(pages), exportRasterPdf(pages)])).every(x => x.byteLength > 1000);
    return { invalidImage, cancelled, customCancellation, timeout, cloneError, retry, parallel, inputPreserved: sameInputs(pages, before) };
  },
};
