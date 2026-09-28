# Lazy-load react-draggable without type casts

`React.lazy(() => import('react-draggable'))` fails type checking in react-draggable 4.7.2, even though ordinary JSX works. [Issue #822](https://github.com/react-grid-layout/react-draggable/issues/822) reports this upgrade problem. The default component's derived-state parameter is too narrow; with React 18 types, both components also expose an incompatible `propTypes` static.

The [source correction](https://github.com/react-grid-layout/react-draggable/pull/825) aligns those public signatures with React's component contract. It preserves optional props, the existing runtime validators and the drag implementation. Both the default `Draggable` and named `DraggableCore` can then be loaded without `as ComponentType`.

## Install and verify

This is an **unofficial temporary build**, version `4.7.2-lazy-types.0`, based on upstream 4.7.2. Use it in a test branch while the upstream correction is under review:

```sh
yarn add --ignore-scripts https://raw.githubusercontent.com/tevinch/data-shape-kit/draggable-lazy-types-v1/downloads/react-draggable-4.7.2-lazy-types.0.tgz
```

Or [download the package](../../downloads/react-draggable-4.7.2-lazy-types.0.tgz?raw=true) and install it with `yarn add --ignore-scripts ./react-draggable-4.7.2-lazy-types.0.tgz`. Keep your application's React and React DOM versions. The archive includes compiled CJS/ESM/UMD files, declarations, source, regression tests, build configuration and the original MIT license. It needs no install-time build.

In a TypeScript project, save [consumer.tsx](consumer.tsx), [tsconfig.json](tsconfig.json) and [package.json](package.json) together in a temporary check directory under your project, then run `yarn tsc -p path/to/check-directory`. The small manifest marks the check as ESM without changing your application. The check compiles both lazy imports and minimal JSX through the real NodeNext export map. Invalid `axis` and `scale` values must still be rejected; their `@ts-expect-error` checks fail if the types become too permissive.

Use the lazy default component inside a Suspense boundary:

```tsx
import {lazy, Suspense, useRef} from 'react';

const Draggable = lazy(() => import('react-draggable'));

export function Card() {
  const nodeRef = useRef<HTMLDivElement>(null);
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Draggable nodeRef={nodeRef}>
        <div ref={nodeRef}>Drag me</div>
      </Draggable>
    </Suspense>
  );
}
```

`DraggableCore` retains its normal behavior: it reports drag callbacks; your code manages positioning. Continue following the [upstream nodeRef and component guidance](https://github.com/react-grid-layout/react-draggable#using-noderef).

## Checks and source

On Node.js 24.19.0 / macOS, `make lint`, all 204 tests and `make build` pass. The build checks CJS exports, the UMD global, absence of a `prop-types` declaration dependency and a real ESM NodeNext consumer. Fresh package consumers pass with React/types 18.3.x and 19.3.0, TypeScript 5.9.3 and `skipLibCheck` disabled. The original source fails the new lazy-import checks in both React type configurations.

These are scripted type, unit and build checks; browser drag tests were not run for this type-only correction. An independent source comparison found identical emitted component JavaScript after removing comments. See [verification.json](verification.json) for exact versions and the archive checksum. Switch back to an official release when it includes the correction and passes your application's checks.

## Optional coffee

If this saves you some time and you'd like to buy me a coffee, thank you. It is entirely optional; the guide, package and source are free.

- **USDC / SOL · Solana:** `9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy`
- **USDC / ETH · Base:** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
- **USDT · BNB Smart Chain (BEP20):** `0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA`
