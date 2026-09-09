// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
'use client';
import { useId, useRef, useState } from 'react';
import type { Selection } from '@tiptap/pm/state';
import { selectionToCsv, SelectionCsvError, type CsvOptions } from './selection-csv.mjs';

export interface CopySelectedCsvProps {
  getSelection: () => Selection;
  csvOptions?: CsvOptions;
}

function errorMessage(error: unknown): string {
  if (error instanceof SelectionCsvError) {
    switch (error.code) {
      case 'MALFORMED_TABLE': return 'The table has inconsistent cell dimensions.';
      case 'UNSUPPORTED_CONTENT': return 'The selection contains unsupported content. Provide a cell text serializer.';
      case 'MAX_ROWS': return 'Select no more than 1,000 rows.';
      case 'MAX_COLUMNS': return 'Select no more than 64 columns.';
      case 'MAX_CHARS': return 'The CSV is too long. Select a smaller range.';
    }
  }
  return 'Could not read the selected cells.';
}

export default function CopySelectedCsv({ getSelection, csvOptions }: CopySelectedCsvProps) {
  const id = useId();
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const copying = useRef(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function copy() {
    if (copying.current) return;
    setOutput(null);
    setStatus('');
    let csv: string | undefined;
    try {
      csv = selectionToCsv(getSelection(), csvOptions);
    } catch (error) {
      setStatus(errorMessage(error));
      return;
    }
    if (csv === undefined) {
      setStatus('Select table cells before copying.');
      return;
    }
    setOutput(csv);
    copying.current = true;
    setBusy(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(csv);
      setStatus('Copied selected cells as CSV.');
    } catch {
      setStatus('Clipboard access is unavailable. Select the output and copy it manually.');
    } finally {
      copying.current = false;
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={copy}>
      {busy ? 'Copying…' : 'Copy as CSV'}
    </button>
    <p role="status" aria-live="polite">{status}</p>
    {output !== null && <div>
      <label htmlFor={id}>CSV from the last selection</label>
      <textarea id={id} ref={outputRef} readOnly spellCheck={false} rows={6} value={output} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} />
      <button type="button" onClick={() => { outputRef.current?.focus(); outputRef.current?.select(); }}>Select output</button>
    </div>}
  </div>;
}
