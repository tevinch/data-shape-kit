# Preserve intentional blank rows in spreadsheet paste

A small, dependency-free C# helper and 15 executable checks for a specific clipboard convention: an external payload ends its last row with CRLF, while a bare final LF can represent an intentional blank row. Copy `ClipboardRows.cs` and `LICENSE` into your project.

The motivating report is [RadzenSpreadsheet #2707](https://github.com/radzenhq/radzen-blazor/issues/2707). Its author describes an extra row being cleared after an Excel paste and identifies two row-counting paths. This example adds a reusable boundary helper and regression cases for the proposed convention. It is not a released Radzen fix.

## Use the original payload

```csharp
using DataShapeKit;

var rows = ClipboardRows.SplitExternalText("1\r\n2\r\n");
// ["1", "2"]

var withBlankRow = ClipboardRows.SplitExternalText("1\r\n\r\n");
// ["1", ""] — the additional blank row remains.

var lfEnding = ClipboardRows.SplitExternalText("1\n");
// ["1", ""] — a bare LF is not consumed.
```

| Original text, shown with escapes | Returned rows |
| --- | --- |
| `1\r\n2\r\n` | `1`, `2` |
| `1\r\n\r\n` | `1`, empty |
| `1\r\n\r\n\r\n` | `1`, empty, empty |
| `1\n` | `1`, empty |
| `\r\n` | one empty row |
| `001\t\t\r\n` | one row containing `001` and two trailing tabs |
| empty string | one empty row, matching `String.Split` semantics |

Null input throws `ArgumentNullException`. The helper preserves spaces, tabs and string values. It does not decide whether an empty clipboard should be ignored; keep that decision in the caller.

## Applying the convention to the reported Radzen paths

The source paths below were inspected on 9 September 2026. Treat these as integration points to review against your version:

1. In [`SpreadsheetClipboard.GetPasteRange`](https://github.com/radzenhq/radzen-blazor/blob/e46e9ce9086bf6ef728b458dd8eb7bb6740d5d16/Radzen.Blazor/Spreadsheet/SpreadsheetClipboard.cs), keep the internal clipboard match and empty-input guard first. In the external-text branch, obtain `lines` with `ClipboardRows.SplitExternalText(pastedText)` instead of splitting the original text directly.
2. In [`Worksheet.InsertDelimitedString`](https://github.com/radzenhq/radzen-blazor/blob/e46e9ce9086bf6ef728b458dd8eb7bb6740d5d16/Radzen.Blazor/Documents/Spreadsheet/Worksheet.cs), obtain `rows` with `ClipboardRows.SplitExternalText(value)`. Keep the existing cell splitting and sheet-boundary handling.
3. Give both consumers the same original payload. Leave the raw text used by `TryPaste` unchanged, so internal copy/cut matching retains its existing behavior.

The range calculation and insertion must agree. Changing only insertion can still make the range check include a row below the intended paste. Changing only the range can leave insertion writing farther than the checked range.

Do not call `Trim`, `TrimEnd`, remove every empty row, or remove a terminal CRLF before passing the result to this helper. Applying the removal twice can erase an intentionally blank last row. The helper removes exactly one CRLF within each call; each call must start from the original text.

Before adopting a change in Radzen, run its real command tests for an untouched cell immediately below the paste, a protected row immediately below it, a deliberately blank final row, internal copy/cut, undo, and a paste at the bottom/right edge. Those are integration checks, not claims made by this standalone suite.

## Run the checks

The console project has no package references; `NuGet.Config` disables package sources. It defaults to `net8.0` and requires a matching SDK and runtime:

```sh
dotnet run --project RowChecks.csproj
```

To select another installed target, pass `CheckTargetFramework`. For example, the checks were compiled and run with SDK 7.0.200 using:

```sh
dotnet run --project RowChecks.csproj --framework net7.0 -p:CheckTargetFramework=net7.0
```

Expected output: `15/15 row-boundary cases passed.` A failed check returns a nonzero exit code. Before adding the helper, the direct-split baseline passed only 4 of these 15 cases. The default .NET 8 target and the complete Radzen application have not been run here.

## Scope

This is a row-boundary compatibility example for the stated CRLF convention. It is not a CSV/TSV parser: quoted multiline fields still need a quote-aware parser, and arbitrary LF-only clipboard formats may use a different final-row convention. The helper cannot infer which convention produced an arbitrary string. It does not read XLSX, validate cells, interpret formulas, or control how the receiving spreadsheet converts values.

## Buy me a coffee, if this helped

If this saved you a little time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback is appreciated too.

- **USDC on Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC on Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Fees depend on your wallet or exchange. Thank you! — Tevinch
