// Copyright 2026 Tevinch. Apache-2.0; see LICENSE.
// Synthetic documents only. No scripts, external resources, or submit actions.
const encoder = new TextEncoder();

export const richTextCases = {
  plain: 'Before Important middle emphasis after normal.',
  bold: 'Before <b>Important</b> middle emphasis after normal.',
  italic: 'Before Important middle <i>emphasis</i> after normal.',
  nested: 'Before <b>Important <i>emphasis</i> bold-again</b> after normal.',
  reverse: 'Before <i>emphasis <b>Important</b> italic-again</i> after normal.',
  styled: 'Before <b style="font-size: 18pt">Important <i>emphasis</i></b> after normal.',
  paragraphs: '<p style="margin-top: 9pt; margin-bottom: 7pt; line-height: 23pt">Before <b>Important</b> middle <i>emphasis</i> after normal.</p><p>Second paragraph remains.</p>',
  wrapping: 'Before <b>Important ' + 'iiii thin letters '.repeat(24) + '</b> <i>emphasis</i> after normal.',
  overrides: 'Before <b style="font-weight:normal">Important</b> middle <i style="font-style:normal">emphasis</i> after normal.',
};

export function asSpans(markup) {
  return markup.replace(/<b(?=[ >])/g, '<span data-style="bold"')
    .replace(/<i(?=[ >])/g, '<span data-style="italic"')
    .replace(/<\/b>|<\/i>/g, '</span>')
    .replace(/data-style="(bold|italic)"(?: style="([^"]*)")?/g, (_, style, rest = '') =>
      `style="${style === 'bold' ? 'font-weight: bold' : 'font-style: italic'}; ${rest}"`);
}

function stream(text) {
  return `<< /Length ${encoder.encode(text).length} >>\nstream\n${text}\nendstream`;
}

export function makePdf(markup, { paragraphs = false } = {}) {
  const content = paragraphs ? markup : `<p>${markup}</p>`;
  const template = `<template xmlns="http://www.xfa.org/schema/xfa-template/3.3">
  <subform name="form" layout="tb" mergeMode="matchTemplate">
    <pageSet><pageArea name="page"><contentArea x="36pt" y="36pt" w="540pt" h="720pt"/>
      <medium stock="default" short="612pt" long="792pt"/></pageArea></pageSet>
    <subform name="first" layout="tb">
      <draw name="heading" w="500pt"><font typeface="Helvetica" size="16pt"/>
        <value><text>Reading and editing example</text></value></draw>
      <draw name="rich" w="260pt"><font typeface="Helvetica" size="12pt"/>
        <para spaceAbove="5pt" spaceBelow="6pt" lineHeight="19pt"/>
        <value><exData contentType="text/html"><body xmlns="http://www.w3.org/1999/xhtml">${content}</body></exData></value></draw>
      <field name="note" w="300pt" h="30pt"><ui><textEdit/></ui>
        <font typeface="Helvetica" size="12pt"/>
        <assist><toolTip>Project note</toolTip></assist>
        <bind match="dataRef" ref="$record.note"/>
        <value><text>Existing project note</text></value></field>
      <field name="reference" w="300pt" h="30pt" access="nonInteractive"><ui><textEdit/></ui>
        <font typeface="Helvetica" size="12pt"/>
        <assist><toolTip>Reference</toolTip></assist>
        <bind match="dataRef" ref="$record.reference"/>
        <value><text>REF-204</text></value></field>
    </subform>
    <subform name="second" layout="tb"><breakBefore targetType="pageArea" startNew="1"/>
      <draw name="end" w="500pt"><font typeface="Helvetica" size="12pt"/>
        <value><text>Page two: original content is still here.</text></value></draw>
    </subform>
  </subform></template>`;
  const datasets = '<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><form><note>Existing project note</note><reference>REF-204</reference></form></xfa:data></xfa:datasets>';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R /NeedsRendering true >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 7 0 R >>',
    '<< /Fields [] /DR << /Font << >> >> /XFA [(preamble) 8 0 R (template) 5 0 R (datasets) 6 0 R (postamble) 9 0 R] >>',
    stream(template), stream(datasets), stream(''),
    stream('<?xml version="1.0"?><xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/">'),
    stream('</xdp:xdp>'),
  ];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}
