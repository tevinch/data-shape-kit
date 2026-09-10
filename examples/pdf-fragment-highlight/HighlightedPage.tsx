import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page, pdfjs } from 'react-pdf';

import type { TextContent } from 'react-pdf';

import { highlightTextItems } from './highlight-text.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type HighlightedPageProps = {
  pageNumber: number;
  queries: readonly string[];
  width: number;
  caseSensitive?: boolean;
  onMatchCount?: (count: number) => void;
};

type TextSnapshot = {
  pageNumber: number;
  items: TextContent['items'];
};

export function HighlightedPage({
  pageNumber,
  queries,
  width,
  caseSensitive = false,
  onMatchCount,
}: HighlightedPageProps) {
  const [snapshot, setSnapshot] = useState<TextSnapshot | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const onMatchCountRef = useRef(onMatchCount);
  const previousPageRef = useRef(pageNumber);

  useEffect(() => {
    onMatchCountRef.current = onMatchCount;
  }, [onMatchCount]);

  const result = useMemo(() => {
    if (!snapshot || snapshot.pageNumber !== pageNumber) return null;
    return highlightTextItems(snapshot.items, queries, { caseSensitive });
  }, [caseSensitive, pageNumber, queries, snapshot]);

  useEffect(() => {
    const pageChanged = previousPageRef.current !== pageNumber;
    previousPageRef.current = pageNumber;
    setSnapshot(null);
    setTextError(null);
    if (pageChanged) onMatchCountRef.current?.(0);
  }, [pageNumber]);

  useEffect(() => {
    if (result) onMatchCountRef.current?.(result.matches.length);
  }, [result]);

  const handleTextSuccess = useCallback((textContent: TextContent) => {
    setTextError(null);
    setSnapshot({ pageNumber, items: textContent.items });
  }, [pageNumber]);

  const handleTextError = useCallback((error: Error) => {
    setSnapshot(null);
    setTextError(error.message || 'The page text could not be read.');
    onMatchCountRef.current?.(0);
  }, []);

  const customTextRenderer = useCallback(({ str, itemIndex }: { str: string; itemIndex: number }) => {
    return result?.html[itemIndex] ?? escapeHtml(str);
  }, [result]);

  return (
    <>
      <Page
        key={pageNumber}
        pageNumber={pageNumber}
        width={width}
        customTextRenderer={customTextRenderer}
        onGetTextError={handleTextError}
        onGetTextSuccess={handleTextSuccess}
        loading={<p className="page-message">Loading page {pageNumber}…</p>}
        error={<p className="page-message page-message--error">Page {pageNumber} could not be displayed.</p>}
      />
      {textError ? <p className="page-message page-message--error" role="alert">Text layer error: {textError}</p> : null}
    </>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}
