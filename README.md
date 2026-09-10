# Data Shape Kit

Free MIT-licensed tools for spreadsheet text, Markdown tables, local file checks, form validation, table selection, calendar arithmetic and chart gaps. Choose a module for your application or try the browser playground. Each tool has its own setup; JavaScript modules do not require Python.

## Choose a tool

| What you need | Start here | Setup |
| --- | --- | --- |
| Parse or copy spreadsheet text while preserving quoted line breaks, empty cells and leading zeros | [Clipboard Table](javascript/clipboard-table) | Copyable JavaScript module; browser or Node.js |
| Turn a copied spreadsheet selection into comma-separated CSV | [Browser playground](https://tevinch.github.io/data-shape-kit/) | No installation; copy or download CSV |
| Convert CSV or tab-separated text into Markdown tables | [Markdown Table](javascript/markdown-table) | Versioned GitHub package; Node.js 20+ for installation |
| Add a table generator to a React application | [React component and DevKit adapter](examples/react-markdown-table) | React 18+; Tailwind CSS 4 or your own styles |
| Keep decimal commas when pasting into Streamlit | [Decimal paste example](examples/streamlit-decimal-paste) | Python helper plus an optional Streamlit app |
| Read the current plain-text paste event in a Glide grid | [Glide paste adapter](examples/glide-plain-text-paste) | Copyable adapter; your application owns validation and writes |
| Copy a selected rectangle of editor table cells as CSV | [ProseMirror selection example](examples/prosemirror-copy-csv) | Tiptap / ProseMirror; optional React copy control |
| Preserve merged cells when table paste fails while creating its selection | [Merged-cell paste patch](examples/merged-cell-paste) | Exact-version ProseMirror 1.8.5 patch; Tiptap 3.31.3 regression fixture |
| Handle an external CRLF terminator while retaining intentional blank rows | [C# row-boundary example](examples/dotnet-clipboard-rows) | Copyable helper and checks; Radzen integration notes |
| Keep CSV codes as text while measurements and counts stay numeric | [Pandas code columns](docs/pandas-csv-code-columns.md) | Python; a two-pass pandas helper with an explicit count-field exception |
| Import literal identifiers without losing zeros or strings such as NA | [Identifier Column](examples/identifier-import) | Python; standard-library CSV and optional XLSX/QR examples |
| Debounce remote validation while keeping form input and submission current | [Remote field check](examples/remote-field-check) | Copyable JavaScript core; React / React Hook Form example and offline demo |
| Show Ant Design local-rule errors immediately while debouncing remote validation | [Ant Design rule example](examples/antd-remote-rule) | Copyable rule bridge and React form with cancellation and immediate submit |
| Keep TanStack Form pending indicators accurate when async field checks overlap | [Validation state patch](examples/tanstack-validation-state) | Exact-version 1.33.5 patch; runnable ESM and CommonJS regression fixture |
| Refresh a pending-operation list when its selected category changes | [Mutation view](examples/mutation-view) | Copyable TypeScript React component; React Query 5.102.8 regression example |
| Add calendar days, weeks, months or years in a chosen time zone with explicit DST handling | [Calendar shift](examples/calendar-shift) | Copyable TypeScript function; Temporal polyfill and Day.js integration checks |
| Draw dashed connections across missing categories or time samples without inventing measurements | [Chart gaps](examples/chart-gaps) | Dependency-free TypeScript adapter; ECharts 6.1.0 SVG checks |
| Keep PapaParse Worker results correct in tested Vite 8 production builds | [Vite Worker configuration and checks](examples/papaparse-vite-worker) | Copyable minifier configuration; runnable browser comparison |
| Select and rename CSV columns while preserving original value alignment | [CSV Column Map](examples/csv-column-map) | Dependency-free JavaScript core; PapaParse 5.7.0 string adapter and tests |
| Select all eligible query results across server-paginated pages, with exclusions | [Cross-page selection](examples/cross-page-selection) | Dependency-free selection module; TanStack Table 9 example with a local read-only server |
| Process UTF-8 CSV records sequentially with asynchronous callbacks and cancellation | [Streaming CSV](examples/streaming-csv) | Node.js 20+; csv-parse integration with strict decoding and header checks |
| Keep blank numeric fields distinct from zero, with typed form inputs and submissions | [Number Input](examples/number-input) | Copyable Zod 4 schemas; React Hook Form example and type checks |
| Replace declared CSV missing markers in selected columns while preserving identifiers and notes | [Missing Tokens](examples/missing-tokens) | Copyable Python module; standard library only |
| Clean, profile, compare or check local files | [Python command-line guide](docs/python-cli.md) | Python 3.11+ |

## Try spreadsheet paste without installing a tool

1. Open the [free browser playground](https://tevinch.github.io/data-shape-kit/).
2. Choose TSV (tabs) or CSV (commas), then **Load example** or paste your table text.
3. Choose CSV, JSON or Markdown table, then copy or download the complete result. CSV includes every input row; its heading option affects only the preview.

For offline use, download the [browser playground v0.4.0 ZIP](downloads/clipboard-table-playground-v0.4.0.zip?raw=true), extract it and open `index.html` in a modern browser. If automatic copying is unavailable, copy the selected output manually. Use CSV download when you need to retain the serialized line endings.

The page processes text locally with no uploads or external runtime assets. The [clipboard guide](javascript/clipboard-table#try-it) explains preview limits and includes a separate source-and-tests download. The [community examples](docs/spreadsheet-clipboard-pitfalls.md) show why splitting on every newline loses multiline cells.

## Generate a Markdown table

Install the fixed GitHub release with Node.js 20 or newer:

```sh
npm install https://raw.githubusercontent.com/tevinch/data-shape-kit/markdown-table-v0.1.1/downloads/tevinch-markdown-table-0.1.1.tgz
```

In an ES module:

```js
import { buildMarkdownTable } from '@tevinch/markdown-table';

const result = buildMarkdownTable('ID,Note\n001,"a|b"', {
  delimiter: ',',
  firstRowHeaders: true,
});
console.log(result.markdown);
```

```text
| ID | Note |
| --- | --- |
| 001 | a\|b |
```

The core has no runtime dependencies. Use `delimiter: '\t'` for spreadsheet text. The package is distributed through GitHub; installation by package name alone is not available. See the [full API, TypeScript setup and optional React entry](javascript/markdown-table).

## Python file tools

The Python CLI supports CSV cleanup, profiling, dictionaries, exact-key comparison, and static checks for supported catalog, feed, calendar and web files. The [command-line guide](docs/python-cli.md) contains installation steps, command examples, tests, data handling and the scope of each check.

For help applying the tools to an eligible file, see the separate [optional service scopes](docs/services.md).

## Share a reproducible example

[Report a component problem or ask an integration question](https://github.com/tevinch/data-shape-kit/issues/new?template=component-feedback.md). Include the component and version, a small invented input, expected output, actual output and relevant runtime versions. Public issues should not contain real datasets, credentials, private URLs or personal information.

## Data handling and limits

The conversion modules make no network requests or storage calls; the surrounding application controls what happens to their output. Clipboard parsers preserve the text they receive, but cannot recover precision or zeros already lost in the source application. They do not read XLSX files or evaluate formulas. Markdown is a presentation format, so rendered whitespace can differ from the original text.

The Glide adapter requires the host application to validate a whole paste before writing. Full Glide runtime integration and Windows Excel round-trip behavior have not been tested. Follow each tool's guide for its limits and verification scope.

## License

[MIT](LICENSE). Use, modify and share the code, retaining the license notice. If a component saves you time, its guide includes a small optional coffee note. Feedback and useful examples are appreciated too.
