"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { useId, useMemo, useRef, useState } from 'react';
import { formatMarkdown, parseDelimited, TABLE_LIMITS } from '../index.mjs';
const nativeControls = {
    Panel: props => _jsx("div", { ...props }),
    Textarea: props => _jsx("textarea", { ...props }),
    Select: props => _jsx("select", { ...props }),
    Button: props => _jsx("button", { ...props }),
};
const SAMPLE = 'ID\tName\tNote\n001\tAda\t"Works | offline\nTwo lines"\n002\t小明\t"Says ""hello"""';
const fieldClass = 'w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const buttonClass = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700';
const cellClass = 'border border-zinc-300 px-3 py-2 align-top dark:border-zinc-700';
const choices = ['none', 'left', 'center', 'right'];
const textAlign = (align) => align === 'right' || align === 'center' ? align : 'left';
/** Native controls by default; pass shared components from an existing design system. */
export default function MarkdownTableGenerator({ controls = {} }) {
    const { Panel, Textarea, Select, Button } = { ...nativeControls, ...controls };
    const id = useId();
    const [input, setInput] = useState(SAMPLE);
    const [delimiter, setDelimiter] = useState('\t');
    const [firstRowHeaders, setFirstRowHeaders] = useState(true);
    const [alignments, setAlignments] = useState([]);
    const [copyStatus, setCopyStatus] = useState('');
    const revision = useRef(0);
    const outputRef = useRef(null);
    const converted = useMemo(() => {
        try {
            const matrix = parseDelimited(input, delimiter);
            const table = formatMarkdown(matrix, { firstRowHeaders, alignments: alignments.slice(0, matrix[0]?.length ?? 0) });
            return { table, error: '' };
        }
        catch (error) {
            return { table: null, error: error instanceof Error ? error.message : 'Could not convert this table.' };
        }
    }, [input, delimiter, firstRowHeaders, alignments]);
    const { table, error } = converted;
    function changed() { revision.current++; setCopyStatus(''); }
    async function copy() {
        const current = revision.current;
        try {
            if (!navigator.clipboard?.writeText)
                throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(table?.markdown ?? '');
            if (current === revision.current)
                setCopyStatus('Copied Markdown.');
        }
        catch {
            if (current === revision.current)
                setCopyStatus('Clipboard unavailable. Select the output and copy it manually.');
        }
    }
    return (_jsxs("div", { className: "space-y-4 text-zinc-900 dark:text-zinc-100", children: [_jsx("p", { className: "text-sm", children: "Paste CSV or spreadsheet text. Conversion stays in this browser; this component makes no network requests." }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsxs(Panel, { className: "flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800", children: [_jsx("label", { htmlFor: `${id}-input`, className: "font-semibold", children: "Table input" }), _jsx(Textarea, { id: `${id}-input`, rows: 10, value: input, spellCheck: false, className: `${fieldClass} font-mono`, "aria-describedby": `${id}-limits`, "aria-invalid": !!error, onChange: event => { changed(); setInput(event.target.value); } }), _jsxs("p", { id: `${id}-limits`, className: "text-xs text-zinc-600 dark:text-zinc-400", children: ["Up to ", TABLE_LIMITS.maxChars.toLocaleString('en-US'), " characters, ", TABLE_LIMITS.maxRows, " rows and ", TABLE_LIMITS.maxColumns, " columns. Quotes may contain delimiters and line breaks. Rows must have equal column counts."] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "flex flex-col gap-1", children: ["Input format", _jsxs(Select, { className: fieldClass, value: delimiter, onChange: event => { changed(); setDelimiter(event.target.value); setAlignments([]); }, children: [_jsx("option", { value: '\t', children: "Spreadsheet / TSV (tabs)" }), _jsx("option", { value: ",", children: "CSV (commas)" })] })] }), _jsxs("label", { className: "flex flex-col gap-1", children: ["Headers", _jsxs(Select, { className: fieldClass, value: String(firstRowHeaders), onChange: event => { changed(); setFirstRowHeaders(event.target.value === 'true'); }, children: [_jsx("option", { value: "true", children: "Use first row as headers" }), _jsx("option", { value: "false", children: "Generate Column 1, Column 2, \u2026" })] })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { className: buttonClass, type: "button", onClick: () => { changed(); setInput(SAMPLE); setDelimiter('\t'); setFirstRowHeaders(true); setAlignments([]); }, children: "Load example" }), _jsx(Button, { className: buttonClass, type: "button", onClick: () => { changed(); setInput(''); setAlignments([]); }, children: "Clear input" })] }), error && _jsxs("p", { role: "alert", className: "rounded border border-red-300 p-3 text-sm text-red-700 dark:text-red-300", children: [error, ". Check quotes, column counts and size limits."] })] }), _jsxs(Panel, { className: "flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800", children: [_jsx("label", { htmlFor: `${id}-output`, className: "font-semibold", children: "Markdown output" }), _jsx("textarea", { ref: outputRef, id: `${id}-output`, readOnly: true, rows: 10, value: table?.markdown ?? '', className: `${fieldClass} font-mono`, spellCheck: false }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { className: buttonClass, type: "button", disabled: !table?.markdown, onClick: copy, children: "Copy Markdown" }), _jsx(Button, { className: buttonClass, type: "button", disabled: !table?.markdown, onClick: () => { outputRef.current?.focus(); outputRef.current?.select(); }, children: "Select output" })] }), _jsx("p", { role: "status", "aria-live": "polite", className: "text-sm", children: copyStatus }), _jsx("p", { className: "text-xs text-zinc-600 dark:text-zinc-400", children: "Cells are literal text. Markdown punctuation and HTML are escaped; line breaks become <br>. Use a GFM renderer that permits <br>. Spaces and tabs may collapse when rendered." })] })] }), !!table?.headers.length && _jsxs(Panel, { className: "space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800", children: [_jsxs("fieldset", { className: "space-y-2", children: [_jsx("legend", { className: "font-semibold", children: "Column alignment" }), _jsx("div", { className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-4", children: table.headers.map((header, i) => _jsxs("label", { className: "flex min-w-0 flex-col gap-1 text-sm", children: [_jsxs("span", { className: "truncate", title: header, children: ["Column ", i + 1, ": ", header || '(empty header)'] }), _jsx(Select, { "aria-label": `Column ${i + 1} alignment`, className: fieldClass, value: alignments[i] ?? 'none', onChange: event => {
                                                changed();
                                                const next = Array.from({ length: table.headers.length }, (_, c) => alignments[c] ?? 'none');
                                                next[i] = event.target.value;
                                                setAlignments(next);
                                            }, children: choices.map(choice => _jsx("option", { value: choice, children: choice }, choice)) })] }, i)) })] }), _jsxs("p", { className: "text-sm", children: [table.rows.length, " data rows, ", table.headers.length, " columns. Preview shows ", Math.min(table.rows.length, 30), " data rows; the Markdown output includes every row."] }), _jsx("div", { className: "max-h-96 overflow-auto", tabIndex: 0, role: "region", "aria-label": "Table preview", children: _jsxs("table", { className: "w-full border-collapse text-sm", children: [_jsx("caption", { className: "sr-only", children: "Literal text preview" }), _jsx("thead", { children: _jsx("tr", { children: table.headers.map((header, i) => _jsx("th", { scope: "col", className: cellClass, style: { textAlign: textAlign(alignments[i]), whiteSpace: 'pre-wrap' }, children: header }, i)) }) }), _jsx("tbody", { children: table.rows.slice(0, 30).map((row, r) => _jsx("tr", { children: row.map((cell, c) => _jsx("td", { className: cellClass, style: { textAlign: textAlign(alignments[c]), whiteSpace: 'pre-wrap' }, children: cell }, c)) }, r)) })] }) }), _jsx("p", { className: "text-xs text-zinc-600 dark:text-zinc-400", children: "This text preview preserves spacing for inspection. Your Markdown viewer controls final whitespace and styling." })] })] }));
}
