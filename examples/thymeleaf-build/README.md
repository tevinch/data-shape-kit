# Build Thymeleaf templates with Parcel

Keep dynamic Thymeleaf head fragments and self-closing `th:block` elements intact while bundling CSS and JavaScript. This example uses Parcel 2.16.4 with the official JavaScript HTML transformer and packager from 2.14.4, installed under npm aliases. No Parcel source files need to be copied or patched.

This is a temporary compatibility configuration for [Parcel issue #10365](https://github.com/parcel-bundler/parcel/issues/10365), reported by solonovamax. The current browser-oriented HTML parser moves custom head elements into the body, even with `--no-optimize`. The original report's template is retained in `src/original.html`; `src/index.html` extends it with dynamic content and assets.

## Run the example

Use Node.js 20 or newer and npm in this directory:

```sh
npm ci --ignore-scripts
npm run build
```

The production output is in `dist/`, including `templates/fragments/common-head.html`. Run Thymeleaf against that directory **before** serving the resulting page. Opening the unrendered template directly in a browser cannot demonstrate server-side fragment behavior.

## Apply it to a project

Install these exact versions alongside Parcel 2.16.4:

```sh
npm install --save-dev --save-exact parcel@2.16.4 @parcel/transformer-posthtml@2.16.4 @parcel/optimizer-htmlnano@2.16.4 @parcel/transformer-html-legacy@npm:@parcel/transformer-html@2.14.4 @parcel/packager-html-legacy@npm:@parcel/packager-html@2.14.4
```

Copy [`legacy.parcelrc`](legacy.parcelrc), [`.posthtmlrc`](.posthtmlrc) and [`htmlnano.config.cjs`](htmlnano.config.cjs), then select the configuration in your build command:

```sh
npx parcel build 'src/**/*.html' --config ./legacy.parcelrc
```

Adapt the entry glob to include your page and fragment files. Preserve any existing PostHTML plugins and project-specific Parcel settings when merging these files. If a project already has another htmlnano configuration, merge the options there instead of leaving competing configuration files.

The transformer and packager aliases select the old JavaScript pipeline while keeping the rest of Parcel at 2.16.4. Version 2.15.4 already uses the newer parser, so it does not provide this fallback.

`recognizeSelfClosing: true` makes PostHTML close a self-closing `th:block` before later content is parsed. The htmlnano configuration keeps explicit tags and attributes, preserves Thymeleaf processing comments, and only applies conservative whitespace reduction and ordinary comment removal to HTML. Parcel still bundles and optimizes external CSS and JavaScript. The htmlnano-stage CSS, JavaScript, JSON and SVG minifiers are disabled. Parcel can still extract and optimize inline scripts, styles and style attributes earlier in the pipeline; Thymeleaf expressions in those locations need separate validation.

## Verify complete template rendering

The optional check needs Python 3 and a Java 11+ JDK. It downloads six pinned dependencies from Maven Central into `verification/lib/` and verifies their SHA-256 values from [`java-dependencies.json`](java-dependencies.json). Set `JAVA_HOME` if the desired JDK is not on your path.

```sh
npm run verify
```

The check builds the default and `--no-optimize` negative controls, builds the compatibility configuration twice, and runs the actual Thymeleaf 3.1.5.RELEASE engine. It compares the complete parsed rendered structures with the source templates, allowing only whitespace reduction and generated CSS/JS filenames. It also checks that:

- the dynamic description remains inside `<head>`;
- the body and existing content survive, with no remaining `th:block` elements;
- prototype-only comment blocks render, parser-level comment blocks disappear, and ordinary build comments are removed;
- conditional content follows both true and false values;
- CSS and JavaScript references resolve to emitted files;
- the cached rebuild emits identical files;
- both default negative controls reproduce the missing head fragment.

Results are written to `verification/results.json`. After a successful check, serve `dist/` and open `rendered.html` to inspect the rendered example. Its script changes “Loading” to “Assets loaded”, and the stylesheet makes the text navy.

## Scope

The complete fixture checks passed with Parcel 2.16.4, Thymeleaf 3.1.5.RELEASE and Temurin Java 21.0.12.1. A software-operated Chrome check also confirmed the rendered dynamic text, navy stylesheet and “Assets loaded” script result, with no reported console errors. The Java checks are scripted; original-reporter adoption and human manual validation have not been confirmed. This configuration is not an upstream fix, and older HTML plugins may lack newer Parcel features or fixes. Test your own templates before adopting it.

The fixture uses standard Thymeleaf HTML mode. It does not verify Spring integration, the Layout Dialect, arbitrary custom dialects, inline template languages, development-server HMR, or every whitespace-sensitive template. The retained `xmlns:layout` declaration is from the original input and does not mean the Layout Dialect ran. It preserves the tested Thymeleaf comment forms; other tools' comment directives may require additions to the predicate. Remove the fallback when a supported upstream configuration meets your workflow.

See [Parcel's HTML and PostHTML documentation](https://parceljs.org/languages/html/) and [Thymeleaf's template guide](https://www.thymeleaf.org/doc/tutorials/3.1/usingthymeleaf.html) for the underlying behavior.

## License

The example is MIT licensed under this repository's [LICENSE](../../LICENSE). The original minimal HTML reproduction is credited above. Dependencies retain their own licenses.

## Optional coffee

The example and checks are free. If they save you time and you would like to buy me a coffee, a small contribution is welcome; there is no obligation.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
