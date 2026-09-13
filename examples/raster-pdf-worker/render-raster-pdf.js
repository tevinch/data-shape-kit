import { jsPDF } from 'jspdf';

export function renderRasterPdf(pages, options = {}) {
  if (!Array.isArray(pages) || pages.length === 0) throw new TypeError('Provide at least one image page.');
  for (const page of pages) {
    if (!page || !['JPEG', 'PNG'].includes(page.format) || !(typeof page.image === 'string' || page.image instanceof Uint8Array)) {
      throw new TypeError('Each page needs a JPEG or PNG image as a Data URL or Uint8Array.');
    }
  }
  const pdf = new jsPDF(options);
  pages.forEach((page, index) => {
    if (index) pdf.addPage();
    pdf.addImage(page.image, page.format, 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), `page-${index}`);
  });
  return pdf.output('arraybuffer');
}
