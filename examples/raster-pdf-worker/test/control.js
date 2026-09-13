import { renderRasterPdf } from '../render-raster-pdf.js';
import { makeSamplePages } from '../sample-pages.js';

window.control = {
  exportOne(s) {
    const pages = makeSamplePages(s.pages, s);
    const options = { unit: 'px', format: s.landscape ? 'letter' : 'a4', orientation: s.landscape ? 'landscape' : 'portrait', hotfixes: ['px_scaling'], ...(s.encrypted ? { encryption: { userPassword: 'sample-view', ownerPassword: 'sample-owner', userPermissions: ['print'] } } : {}) };
    const buffer = renderRasterPdf(pages, options);
    const bytes = new Uint8Array(buffer); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { base64: btoa(binary), bytes: bytes.length };
  },
};
