import { exportRasterPdf } from './export-raster-pdf.js';
import { makeSamplePages } from './sample-pages.js';

const start = document.querySelector('#export');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const protectedInput = document.querySelector('#protected');
let aborter, url;
const release = () => { if (url) URL.revokeObjectURL(url); url = undefined; download.hidden = true; download.removeAttribute('href'); };
start.addEventListener('click', async () => {
  release(); aborter = new AbortController();
  start.disabled = protectedInput.disabled = true; cancel.disabled = false;
  status.textContent = 'Preparing the report...';
  try {
    const options = { unit: 'px', format: 'a4', orientation: 'portrait', hotfixes: ['px_scaling'] };
    if (protectedInput.checked) options.encryption = { userPassword: 'sample-view', ownerPassword: 'sample-owner', userPermissions: ['print'] };
    const buffer = await exportRasterPdf(makeSamplePages(5), options, { signal: aborter.signal });
    url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
    download.href = url; download.hidden = false;
    status.textContent = `Five-page PDF ready (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB).`;
  } catch (error) { status.textContent = error.name === 'AbortError' ? 'Export cancelled. You can try again.' : `Export failed: ${error.message}`; }
  finally { start.disabled = protectedInput.disabled = false; cancel.disabled = true; aborter = undefined; }
});
cancel.addEventListener('click', () => aborter?.abort());
window.addEventListener('pagehide', () => { aborter?.abort(); release(); });
