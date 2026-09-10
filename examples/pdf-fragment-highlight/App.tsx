import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, pdfjs } from 'react-pdf';

import type { PDFDocumentProxy } from 'pdfjs-dist';

import { HighlightedPage } from './HighlightedPage.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const sampleUrl = new URL('./sample.pdf?no-inline', import.meta.url).toString();
const defaultPrimaryQuery = 'A shared sentence can cross several small fragments without losing a match.';

export default function App() {
  const [primaryQuery, setPrimaryQuery] = useState(defaultPrimaryQuery);
  const [secondQuery, setSecondQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [viewerWidth, setViewerWidth] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);

  const queries = useMemo(() => [primaryQuery, secondQuery], [primaryQuery, secondQuery]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const updateWidth = (width: number) => {
      setViewerWidth(Math.max(0, Math.min(612, Math.floor(width))));
    };
    updateWidth(viewer.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => updateWidth(entry.contentRect.width));
    observer.observe(viewer);
    return () => observer.disconnect();
  }, []);

  const handleDocumentLoad = useCallback(({ numPages }: PDFDocumentProxy) => {
    setDocumentError(null);
    setPageCount(numPages);
    setPageNumber((current) => Math.min(current, numPages));
  }, []);

  const handleDocumentError = useCallback((error: Error) => {
    setDocumentError(error.message || 'The PDF could not be loaded.');
    setPageCount(null);
    setMatchCount(null);
  }, []);

  const showPage = (nextPage: number) => {
    setMatchCount(null);
    setPageNumber(nextPage);
  };

  const clearQueries = () => {
    setPrimaryQuery('');
    setSecondQuery('');
  };

  const resetQueries = () => {
    setPrimaryQuery(defaultPrimaryQuery);
    setSecondQuery('');
    setCaseSensitive(false);
  };

  const status = matchCount === null
    ? `Reading text for page ${pageNumber}…`
    : `${matchCount} ${matchCount === 1 ? 'match' : 'matches'} on page ${pageNumber}`;

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">React-PDF example</p>
        <h1 id="page-title">Highlight phrases across PDF text fragments</h1>
        <p>
          Search literal wording across font runs and explicit line endings. Matches use the PDF text layer,
          so the source document and its positioning stay unchanged.
        </p>
      </section>

      <section className="controls" aria-label="Highlight controls">
        <label htmlFor="primary-query">Primary phrase</label>
        <textarea
          id="primary-query"
          rows={3}
          value={primaryQuery}
          onChange={(event) => setPrimaryQuery(event.target.value)}
        />

        <label htmlFor="second-query">Second phrase (optional)</label>
        <input
          id="second-query"
          type="text"
          value={secondQuery}
          onChange={(event) => setSecondQuery(event.target.value)}
          placeholder="Invoice A+B (draft) & <review>"
        />

        <div className="control-row">
          <label className="check-control" htmlFor="case-sensitive">
            <input
              id="case-sensitive"
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            Case-sensitive
          </label>
          <div className="query-actions">
            <button type="button" className="button button--quiet" onClick={clearQueries}>Clear</button>
            <button type="button" className="button button--quiet" onClick={resetQueries}>Reset</button>
          </div>
        </div>
      </section>

      <section className="viewer-card" aria-label="PDF preview">
        <div className="viewer-toolbar">
          <div className="page-actions" aria-label="Page navigation">
            <button
              type="button"
              className="button"
              disabled={pageNumber <= 1}
              onClick={() => showPage(pageNumber - 1)}
            >
              Previous
            </button>
            <span>Page {pageNumber} of {pageCount ?? '…'}</span>
            <button
              type="button"
              className="button"
              disabled={pageCount === null || pageNumber >= pageCount}
              onClick={() => showPage(pageNumber + 1)}
            >
              Next
            </button>
          </div>
          <p className="match-status" role="status" aria-live="polite">{status}</p>
        </div>

        <div className="pdf-frame" ref={viewerRef}>
          {viewerWidth > 0 ? (
            <Document
              file={sampleUrl}
              onLoadSuccess={handleDocumentLoad}
              onLoadError={handleDocumentError}
              loading={<p className="page-message">Loading the two-page sample…</p>}
              error={<p className="page-message page-message--error">The sample PDF could not be displayed.</p>}
            >
              <HighlightedPage
                key={pageNumber}
                pageNumber={pageNumber}
                queries={queries}
                width={viewerWidth}
                caseSensitive={caseSensitive}
                onMatchCount={setMatchCount}
              />
            </Document>
          ) : <p className="page-message">Preparing the preview…</p>}
        </div>
        {documentError ? <p className="document-error" role="alert">PDF error: {documentError}</p> : null}
      </section>

      <section className="scope-note" aria-labelledby="scope-title">
        <h2 id="scope-title">Scope</h2>
        <p>
          This example searches extracted text in page order. It does not perform OCR, rebuild reading order,
          dehyphenate words, or search across pages.
        </p>
      </section>

      <footer className="coffee-note">
        <p>If this example saved you time, you can optionally buy me a coffee:</p>
        <ul>
          <li><strong>USDC / SOL · Solana:</strong> <code>9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy</code></li>
          <li><strong>USDC / ETH · Base:</strong> <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code></li>
          <li><strong>USDT · BNB Smart Chain (BEP20):</strong> <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code></li>
        </ul>
      </footer>
    </main>
  );
}
