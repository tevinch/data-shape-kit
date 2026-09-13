import { renderRasterPdf } from './render-raster-pdf.js';

self.onmessage = ({ data }) => {
  try {
    const buffer = renderRasterPdf(data.pages, data.options);
    self.postMessage({ buffer }, [buffer]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'PDF export failed.' });
  }
};
