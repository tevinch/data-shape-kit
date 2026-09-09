# Data Shape Kit

Free MIT-licensed tools for spreadsheet text, Markdown tables and local file checks. Choose a module for your application or try the browser playground. Each tool has its own setup; JavaScript modules do not require Python.

## Choose a tool

| What you need | Start here | Setup |
| --- | --- | --- |
| Parse or copy spreadsheet text while preserving quoted line breaks, empty cells and leading zeros | [Clipboard Table](javascript/clipboard-table) | Copyable JavaScript module; browser or Node.js |
| Convert CSV or tab-separated text into Markdown tables | [Markdown Table](javascript/markdown-table) | Versioned GitHub package; Node.js 20+ for installation |
| Add a table generator to a React application | [React component and DevKit adapter](examples/react-markdown-table) | React 18+; Tailwind CSS 4 or your own styles |
| Keep decimal commas when pasting into Streamlit | [Decimal paste example](examples/streamlit-decimal-paste) | Python helper plus an optional Streamlit app |
| Read the current plain-text paste event in a Glide grid | [Glide paste adapter](examples/glide-plain-text-paste) | Copyable adapter; your application owns validation and writes |
| Copy a selected rectangle of editor table cells as CSV | [ProseMirror selection example](examples/prosemirror-copy-csv) | Tiptap / ProseMirror; optional React copy control |
| Clean, profile, compare or check local files | [Python command-line guide](docs/python-cli.md) | Python 3.11+ |

## Try spreadsheet paste without installing a tool

1. Download the [browser playground ZIP](downloads/clipboard-table-playground-v0.1.0.zip?raw=true).
2. Extract it and open `index.html` in a modern browser.
3. Choose **Load example**, or paste tab-separated text, then download the result as JSON.

The page processes text locally with no uploads or external runtime assets. The [clipboard guide](javascript/clipboard-table#try-it) explains preview limits and includes a separate source-and-tests download. The [community examples](docs/spreadsheet-clipboard-pitfalls.md) show why splitting on every newline loses multiline cells.

## Generate a Markdown table

Install the fixed GitHub release with Node.js 20 or newer:

```sh
npm install https://raw.githubusercontent.com/tevinch/data-shape-kit/markdown-table-v0.1.0/downloads/tevinch-markdown-table-0.1.0.tgz
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
