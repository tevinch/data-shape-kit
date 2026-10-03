# CSL family names

Keep already structured surnames together when a CSL JSON bibliography goes through Pandoc. For example, `de Gaulle` should stay `de Gaulle, Charles` in the reference list, and `p’Bitek` should stay `p’Bitek, Okot`. This free Python command prepares a separate bibliography after each export. Python 3.10 or newer is enough; no packages are required.

## Download and try it

[Download the source and checks](https://github.com/tevinch/data-shape-kit/raw/refs/heads/main/downloads/csl-family-names-v0.1.0.zip), extract the ZIP, and open a terminal in its `csl-family-names` folder. With Pandoc installed:

```sh
python3 family_names.py example.json example.pandoc.json
pandoc --citeproc --bibliography example.pandoc.json example.md -o example.html
```

Open `example.html`. Its references keep `de Gaulle` and `p’Bitek` intact. The examples with explicit `van`, `von`, `al-` and `de` particles continue to follow the citation style.

On Windows, use `py -3` in place of `python3` if that is how Python is installed.

## Use it after a Zotero export

Use this when the exported `family` fields already contain the intended complete surnames. In Zotero, a surname that must stay together can be entered with literal straight double quotes, such as `"de Gaulle"`. Its CSL JSON exporter removes those protective quotes. The resulting field can therefore be split again by Pandoc. The [export implementation](https://github.com/zotero/utilities/blob/master/utilities_item.js) explains that behavior.

1. Export the selected references as **CSL JSON** to `library.json` and let the export finish.
2. Run the preparation command below. It creates or replaces `library.pandoc.json`; `library.json` stays unchanged.
3. Point Pandoc at the derived bibliography and generate the document. Repeat both commands after each new export.

```sh
python3 family_names.py library.json library.pandoc.json
pandoc --citeproc --bibliography library.pandoc.json article.md -o article.html
```

Continue to the Pandoc command only if preparation succeeds. In a shell or build task that supports it, connect the commands with `&&` so a failed preparation cannot use an older derived file.

If the document or a defaults file already sets `bibliography`, change that setting to the derived file instead of also loading the original. Inline `references` are a separate source and can override bibliography entries with matching IDs; this command does not edit them.

Check a representative reference list after the first run. If the export already contains `"family": "Gaulle", "non-dropping-particle": "de"`, the tool preserves that explicit split. Correct the name in the source library and export again if that split is unwanted. It cannot infer a person's intended name from an already incorrect export.

## What changes

For a personal name with no explicit `non-dropping-particle`, the command wraps a nonempty `family` value in straight double quotes. Pandoc consumes these quotes as its documented protection against particle extraction. Names that are already protected stay unchanged, so running the tool twice does not add more quotes. See [Pandoc's name guidance](https://github.com/jgm/pandoc/blob/main/MANUAL.txt#names) and the [CSL particle rules](https://docs.citationstyles.org/en/stable/specification.html#name-particles).

Explicit non-dropping particles, including an empty string, take precedence. Corporate `literal` names are untouched. The command also preserves given names, dropping particles, suffixes, citation IDs, item order and other metadata. It handles all 26 name fields in the [CSL JSON schema](https://github.com/citation-style-language/schema/blob/master/schemas/input/csl-data.json), including authors, editors and translators. Other objects containing a key called `family` are untouched.

The output is formatted JSON, so its spacing and number spelling may change; decimal metadata is not rounded through a binary float. Input must be a UTF-8 CSL JSON array. Duplicate keys, malformed JSON, non-JSON numeric constants and invalid name-list shapes fail before the output is replaced. This is a focused preparation step, not a full CSL schema validator. Files are read locally and held in memory. The command makes no network requests.

The output must be a different file. Existing derived output is replaced after a successful write. A matching input/output path, hard link to the input, or symbolic-link output is rejected.

## Scope

This opts into keeping the exported family fields together. Use it for an already structured bibliography, where separate particle fields express any intended splitting. If a file intentionally relies on Pandoc to guess particles from unstructured surnames, keep that file on the ordinary Pandoc path.

The command handles external CSL JSON. It does not rewrite BibTeX, inline YAML references, given-name particle parsing, or CSL style settings. Keep the derived file for Pandoc; the unmodified export remains available to other tools.

[The original discussion](https://github.com/jgm/pandoc/issues/11911) covers both an inline reference example and the repeated-export problem. This optional preparation step uses the existing quoted-name mechanism. It does not add a global `parse-names` setting to Pandoc.

## Run the checks

```sh
python3 -m unittest -v
python3 check_pandoc.py --pandoc pandoc
```

Verified with Python 3.12 and Pandoc 3.12. Six unit tests cover preservation, repeated output, Unicode, existing protection, exact numeric metadata and rejected writes. The Pandoc check verifies the original six-name workflow, citation resolution, reference ordering and a second export with changed content. A second style checks explicit particles, editors, translators, an institution and a suffix in the final HTML.

Separately, the official Zotero CSL JSON export functions were run on synthetic records with host lookup stubs: two exports, six item conversions and four complete Pandoc conversions confirmed the quote-removal step and the prepared result. This was a programmatic function check, not Zotero desktop or Better BibTeX plugin validation. No original reporter has confirmed adoption of this helper.

Original code is [MIT licensed](LICENSE). Copy `family_names.py` and the license into a project, or keep the complete example for its checks.

## Buy me a coffee, if this helped

If this saved you some time, you're welcome to buy me a coffee. Please don't feel obliged — the code stays free, and feedback is welcome too.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`

Please match the asset and network exactly. Thank you! — Tevinch
