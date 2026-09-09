"use client";
// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { useId, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ComponentType, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { formatMarkdown, parseDelimited, TABLE_LIMITS } from '../../javascript/markdown-table/index.mjs';
import type { Alignment, Delimiter } from '../../javascript/markdown-table/index.mjs';

export interface GeneratorControls {
  Panel: ComponentType<{ children: ReactNode; className?: string }>;
  Textarea: ComponentType<TextareaHTMLAttributes<HTMLTextAreaElement>>;
  Select: ComponentType<SelectHTMLAttributes<HTMLSelectElement>>;
  Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;
}
const nativeControls: GeneratorControls = {
  Panel: props => <div {...props} />,
  Textarea: props => <textarea {...props} />,
  Select: props => <select {...props} />,
  Button: props => <button {...props} />,
};
const SAMPLE = 'ID\tName\tNote\n001\tAda\t"Works | offline\nTwo lines"\n002\t小明\t"Says ""hello"""';
const fieldClass = 'w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const buttonClass = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700';
const cellClass = 'border border-zinc-300 px-3 py-2 align-top dark:border-zinc-700';
const choices: Alignment[] = ['none', 'left', 'center', 'right'];
const textAlign = (align: Alignment | undefined): 'left' | 'center' | 'right' => align === 'right' || align === 'center' ? align : 'left';

/** Native controls by default; pass shared components from an existing design system. */
export default function MarkdownTableGenerator({ controls = {} }: { controls?: Partial<GeneratorControls> }) {
  const { Panel, Textarea, Select, Button } = { ...nativeControls, ...controls };
  const id = useId();
  const [input, setInput] = useState(SAMPLE);
  const [delimiter, setDelimiter] = useState<Delimiter>('\t');
  const [firstRowHeaders, setFirstRowHeaders] = useState(true);
  const [alignments, setAlignments] = useState<Alignment[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const revision = useRef(0);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const converted = useMemo(() => {
    try {
      const matrix = parseDelimited(input, delimiter);
      const table = formatMarkdown(matrix, { firstRowHeaders, alignments: alignments.slice(0, matrix[0]?.length ?? 0) });
      return { table, error: '' };
    } catch (error) {
      return { table: null, error: error instanceof Error ? error.message : 'Could not convert this table.' };
    }
  }, [input, delimiter, firstRowHeaders, alignments]);
  const { table, error } = converted;
  function changed() { revision.current++; setCopyStatus(''); }
  async function copy() {
    const current = revision.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(table?.markdown ?? '');
      if (current === revision.current) setCopyStatus('Copied Markdown.');
    } catch {
      if (current === revision.current) setCopyStatus('Clipboard unavailable. Select the output and copy it manually.');
    }
  }
  return (
    <div className="space-y-4 text-zinc-900 dark:text-zinc-100">
      <p className="text-sm">Paste CSV or spreadsheet text. Conversion stays in this browser; this component makes no network requests.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <label htmlFor={`${id}-input`} className="font-semibold">Table input</label>
          <Textarea id={`${id}-input`} rows={10} value={input} spellCheck={false} className={`${fieldClass} font-mono`}
            aria-describedby={`${id}-limits`} aria-invalid={!!error}
            onChange={event => { changed(); setInput(event.target.value); }} />
          <p id={`${id}-limits`} className="text-xs text-zinc-600 dark:text-zinc-400">Up to {TABLE_LIMITS.maxChars.toLocaleString('en-US')} characters, {TABLE_LIMITS.maxRows} rows and {TABLE_LIMITS.maxColumns} columns. Quotes may contain delimiters and line breaks. Rows must have equal column counts.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">Input format
              <Select className={fieldClass} value={delimiter} onChange={event => { changed(); setDelimiter(event.target.value as Delimiter); setAlignments([]); }}>
                <option value={'\t'}>Spreadsheet / TSV (tabs)</option><option value=",">CSV (commas)</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1">Headers
              <Select className={fieldClass} value={String(firstRowHeaders)} onChange={event => { changed(); setFirstRowHeaders(event.target.value === 'true'); }}>
                <option value="true">Use first row as headers</option><option value="false">Generate Column 1, Column 2, …</option>
              </Select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className={buttonClass} type="button" onClick={() => { changed(); setInput(SAMPLE); setDelimiter('\t'); setFirstRowHeaders(true); setAlignments([]); }}>Load example</Button>
            <Button className={buttonClass} type="button" onClick={() => { changed(); setInput(''); setAlignments([]); }}>Clear input</Button>
          </div>
          {error && <p role="alert" className="rounded border border-red-300 p-3 text-sm text-red-700 dark:text-red-300">{error}. Check quotes, column counts and size limits.</p>}
        </Panel>
        <Panel className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <label htmlFor={`${id}-output`} className="font-semibold">Markdown output</label>
          <textarea ref={outputRef} id={`${id}-output`} readOnly rows={10} value={table?.markdown ?? ''} className={`${fieldClass} font-mono`} spellCheck={false} />
          <div className="flex flex-wrap gap-2">
            <Button className={buttonClass} type="button" disabled={!table?.markdown} onClick={copy}>Copy Markdown</Button>
            <Button className={buttonClass} type="button" disabled={!table?.markdown} onClick={() => { outputRef.current?.focus(); outputRef.current?.select(); }}>Select output</Button>
          </div>
          <p role="status" aria-live="polite" className="text-sm">{copyStatus}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Cells are literal text. Markdown punctuation and HTML are escaped; line breaks become &lt;br&gt;. Use a GFM renderer that permits &lt;br&gt;. Spaces and tabs may collapse when rendered.</p>
        </Panel>
      </div>
      {!!table?.headers.length && <Panel className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <fieldset className="space-y-2">
          <legend className="font-semibold">Column alignment</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {table.headers.map((header, i) => <label key={i} className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="truncate" title={header}>Column {i + 1}: {header || '(empty header)'}</span>
              <Select aria-label={`Column ${i + 1} alignment`} className={fieldClass} value={alignments[i] ?? 'none'} onChange={event => {
                changed(); const next = Array.from({ length: table.headers.length }, (_, c) => alignments[c] ?? 'none');
                next[i] = event.target.value as Alignment; setAlignments(next);
              }}>{choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}</Select>
            </label>)}
          </div>
        </fieldset>
        <p className="text-sm">{table.rows.length} data rows, {table.headers.length} columns. Preview shows {Math.min(table.rows.length, 30)} data rows; the Markdown output includes every row.</p>
        <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="Table preview">
          <table className="w-full border-collapse text-sm"><caption className="sr-only">Literal text preview</caption>
            <thead><tr>{table.headers.map((header, i) => <th key={i} scope="col" className={cellClass} style={{ textAlign: textAlign(alignments[i]), whiteSpace: 'pre-wrap' }}>{header}</th>)}</tr></thead>
            <tbody>{table.rows.slice(0, 30).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className={cellClass} style={{ textAlign: textAlign(alignments[c]), whiteSpace: 'pre-wrap' }}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">This text preview preserves spacing for inspection. Your Markdown viewer controls final whitespace and styling.</p>
      </Panel>}
    </div>
  );
}
