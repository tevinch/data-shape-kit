// Copyright 2026 Tevinch. Apache-2.0; see LICENSE.
import { asSpans, makePdf, richTextCases } from './fixtures.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function walk(node) {
  return [node, ...(node.children ?? []).flatMap(walk)];
}

export function contentOf(node) {
  return walk(node).map(item => item.value ?? '').join(' ');
}

function richBox(node) {
  for (const item of walk(node)) {
    if (item.children?.some(child => child.attributes?.xfaName === 'rich')) {
      return item.attributes.style;
    }
  }
  throw new Error('Rich-text layout was not produced');
}

function referencePreserved(html) {
  const ref = walk(html).find(x => x.attributes?.xfaName === 'reference');
  return ref?.attributes?.class?.includes('xfaNonInteractive') &&
    walk(ref).some(x => x.name === 'input' && x.attributes?.value === 'REF-204');
}

export async function runChecks(pdfjs, options, report = () => {}) {
  const results = [];
  async function check(name, body) {
    try { await body(); results.push({name, passed: true}); }
    catch (error) { results.push({name, passed: false, error: error.message}); }
    report(results.at(-1));
  }
  async function withDocument(data, callback, overrides = {}) {
    // getDocument transfers its input buffer; retain independent bytes for reopening.
    const task = pdfjs.getDocument({...options, data: new Uint8Array(data), enableXfa: true, ...overrides});
    try { return await callback(await task.promise); }
    finally { await task.destroy(); }
  }

  for (const [name, markup] of Object.entries(richTextCases)) {
    await check(`${name}: two pages, all text, and matching styled-span geometry`, async () => {
      const fixtureOptions = {paragraphs: name === 'paragraphs'};
      const first = await withDocument(makePdf(markup, fixtureOptions), async doc => {
        assert(doc.isPureXfa, 'XFA must actually be enabled and parsed');
        assert(doc.numPages === 2, `Expected two actual pages, got ${doc.numPages}`);
        const page = await doc.getPage(1);
        const html = await page.getXfa();
        const text = contentOf(html);
        assert(text.includes('Before') && text.includes('Important') && text.includes('emphasis') && text.includes('after normal.'), 'Rich text lost content');
        const bold = walk(html).filter(x => x.name === 'b');
        const italic = walk(html).filter(x => x.name === 'i');
        if (markup.includes('<b')) assert(bold.length > 0, 'Bold markup disappeared');
        if (markup.includes('<i')) assert(italic.length > 0, 'Italic markup disappeared');
        for (const node of bold) assert(node.attributes?.style?.fontWeight === (name === 'overrides' ? 'normal' : 'bold'), 'Bold appearance lost or explicit normal weight ignored');
        for (const node of italic) assert(node.attributes?.style?.fontStyle === (name === 'overrides' ? 'normal' : 'italic'), 'Italic appearance lost or explicit normal posture ignored');
        assert(contentOf(await (await doc.getPage(2)).getXfa()).includes('Page two: original content is still here.'), 'Following page lost content');
        const fields = walk(html).filter(x => x.name === 'input');
        assert(fields.some(x => x.attributes?.value === 'Existing project note'), 'Prefilled note missing');
        assert(referencePreserved(html), 'Non-interactive reference lost its content or setting');
        return richBox(html);
      });
      const equivalent = await withDocument(makePdf(asSpans(markup), fixtureOptions), async doc => richBox(await (await doc.getPage(1)).getXfa()));
      assert(JSON.stringify(first) === JSON.stringify(equivalent), `Layout differs from equivalent span styles: ${JSON.stringify({first,equivalent})}`);
    });
  }

  await check('edit, save, reopen, edit again: new and existing content survive', async () => {
    let bytes = makePdf(richTextCases.nested);
    for (const value of ['Updated project note', 'Second revision']) {
      bytes = await withDocument(bytes, async doc => {
        const html = await (await doc.getPage(1)).getXfa();
        const field = walk(html).find(x => x.name === 'input' && x.attributes?.['aria-label'] === 'Project note');
        assert(field?.attributes?.dataId, 'No editable XFA data binding');
        doc.annotationStorage.setValue(field.attributes.dataId, {value});
        assert(doc.annotationStorage.size > 0, 'Edit never reached annotation storage');
        return await doc.saveDocument();
      });
      await withDocument(bytes, async doc => {
        assert(doc.numPages === 2, 'Save lost a page');
        const html = await (await doc.getPage(1)).getXfa();
        const fields = walk(html).filter(x => x.name === 'input');
        assert(fields.some(x => x.attributes?.value === value), 'Saved note was not restored');
        assert(referencePreserved(html), 'Save changed the non-interactive reference');
        assert(contentOf(html).includes('bold-again') && contentOf(html).includes('after normal.'), 'Save lost rich text');
        assert(contentOf(await (await doc.getPage(2)).getXfa()).includes('Page two:'), 'Save lost following content');
      });
    }
  });

  await check('enableXfa:false remains disabled', async () => {
    await withDocument(makePdf(richTextCases.nested), async doc => {
      assert(!doc.isPureXfa, 'XFA was enabled despite the setting');
      assert(await (await doc.getPage(1)).getXfa() === null, 'Disabled XFA unexpectedly produced a form');
    }, {enableXfa:false});
  });
  return results;
}
