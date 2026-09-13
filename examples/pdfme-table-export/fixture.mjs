import { table, text } from '@pdfme/schemas';

// Geometry from pdfme/pdfme#1598; style values use the standard table plugin.
export function createTemplate(captionY = 20) {
  const tableSchema = structuredClone(table.propPanel.defaultSchema);
  const captionSchema = structuredClone(text.propPanel.defaultSchema);
  for (const styles of [tableSchema.headStyles, tableSchema.bodyStyles]) {
    Object.assign(styles, { fontName: 'Roboto', fontSize: 13, lineHeight: 1 });
    styles.padding = { top: 5, right: 5, bottom: 5, left: 5 };
  }
  return {
    basePdf: { width: 210, height: 297, padding: [15, 15, 15, 15] },
    schemas: [[
      { ...tableSchema, name: 'tbl', position: { x: 15, y: 19.91 }, width: 150, height: 52.932,
        showHead: true, head: ['A', 'B', 'C'], headWidthPercentages: [30, 30, 40],
        content: JSON.stringify([['1', '2', '3']]) },
      { ...captionSchema, name: 'caption', position: { x: 15, y: captionY }, width: 70, height: 9,
        fontName: 'Roboto', fontSize: 11, content: 'CAPTION' },
    ]],
  };
}
