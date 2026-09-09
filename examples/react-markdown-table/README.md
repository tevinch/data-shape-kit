# React Markdown Table Generator

A free React component for pasted CSV and spreadsheet text, with column headers, per-column alignment, quoted multiline cells, literal text escaping, Markdown output, and a text preview. Built in response to [DevKit's Markdown table request](https://github.com/Abdellox/DevKit/issues/1).

All conversion runs in the browser. The component makes no network requests and does not store input. A host page's own scripts and services are outside this component's scope.

## Use in a React project

Copy this component and the [conversion module](../../javascript/markdown-table), keeping the relative directory structure or updating the two module import paths. Keep `index.d.mts` beside `index.mjs` and retain the MIT license. Import the component in your page:

```tsx
import MarkdownTableGenerator from './markdown-table-generator';

export default function Example() {
  return <MarkdownTableGenerator />;
}
```

Requires React 18 or newer. The included classes target Tailwind CSS 4; without Tailwind the native controls still work, but the layout needs your own styles. The `"use client"` directive supports use from a Next.js App Router page. No new runtime package is required beyond React.

Choose **Spreadsheet / TSV** or **CSV** explicitly, then choose whether the first row contains headers. Adjust each column's alignment. **Copy Markdown** reports success or a readable clipboard error; **Select output** supports manual copying when clipboard access is unavailable. Copying requires the browser's clipboard permission and a suitable page context.

The preview shows the first 30 data rows. The output includes the full accepted table. Invalid input clears the output instead of leaving a stale successful result. The limits are 100,000 UTF-16 code units, 1,000 input rows, and 64 columns. Column counts must match.

The preview renders React text nodes, with no Markdown parser or HTML injection. It preserves spaces for inspection; the downstream Markdown renderer controls final whitespace and styling. Cell line breaks use `<br>` in the generated Markdown. See [module behavior and rendering limits](../../javascript/markdown-table#literal-text-and-rendering).

## Plug into DevKit

These steps match the source and shared-control signatures inspected on September 9, 2026. The adapter is provided for review; DevKit's complete application build and lint have not been run here.

1. Copy `javascript/markdown-table/index.mjs`, `index.d.mts`, and `LICENSE` into `lib/tools/markdown-table/` in DevKit.
2. Copy `markdown-table-generator.tsx` into `components/tools/markdown-table-generator.tsx`. Change both module imports from `../../javascript/markdown-table/index.mjs` to `@/lib/tools/markdown-table/index.mjs`.
3. Copy `devkit-adapter.tsx` into `components/tools/markdown-table-tool.tsx`. This wrapper uses DevKit's shared `Panel`, `Textarea`, `Select`, and `Button` controls. The output textarea is native so **Select output** can focus and select it without requiring a forwarded ref from the shared control.
4. In `lib/tools/registry.ts`, import `Table2` from `lucide-react` and the adapter:

```tsx
import MarkdownTableTool from '@/components/tools/markdown-table-tool';
```

Add this entry to the existing `tools` array:

```tsx
{
  slug: 'markdown-table-generator',
  name: 'Markdown Table Generator',
  description: 'Turn pasted CSV or spreadsheet text into a Markdown table with headers and column alignment.',
  category: 'generators',
  icon: Table2,
  keywords: ['markdown', 'table', 'csv', 'tsv', 'spreadsheet'],
  component: MarkdownTableTool,
},
```

5. Add “Markdown table generator” to the existing `SITE_DESCRIPTION` string in `lib/site.ts` if desired. In the inspected source, tool icons and tool descriptions live in the registry; `lib/site.ts` contains site-wide metadata. There is no separate icon registry there.
6. Run the project's required `npm run lint` and `npm run build`, then check `/tools/markdown-table-generator`. Confirm the host's own theme, routing and responsive layout before merging.

The core module's Node tests, optional Marked integration check, TypeScript check, and an isolated React browser preview can be run independently of DevKit. These checks do not establish that a change has been accepted or merged upstream.

## Other design systems

The `controls` prop accepts optional `Panel`, `Textarea`, `Select`, and `Button` components. Their props use standard React HTML attributes, except `Panel`, which needs `children` and optional `className`. Keep replacements stable across renders. The supplied [DevKit adapter](devkit-adapter.tsx) is a small example.

## Optional coffee

The component and adapter are free under the MIT license. If they save you some time and you feel like buying me a coffee, thank you — no contribution is expected.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Transfer and withdrawal fees depend on your wallet or exchange.
