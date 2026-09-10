import { useState, useSyncExternalStore } from 'react';
import { DemoForm } from './DemoForm.js';
import { createRenderCountStore } from './render-counts.js';
import type { RenderCountStore } from './render-counts.js';

const countKeys = [
  'original.group',
  'original.profile.firstName',
  'original.profile.lastName',
  'original.backup.firstName',
  'original.backup.lastName',
  'isolated.group',
  'isolated.profile.firstName',
  'isolated.profile.lastName',
  'isolated.backup.firstName',
  'isolated.backup.lastName',
] as const;

function RenderCountDashboard({
  counts,
}: Readonly<{ counts: RenderCountStore }>) {
  const snapshot = useSyncExternalStore(
    counts.subscribe,
    counts.getSnapshot,
    counts.getSnapshot,
  );

  return (
    <div className="dashboard-card">
      <div className="dashboard-heading">
        <div>
          <h2 id="counts-heading">Committed renders</h2>
          <p>Compare deltas after the page mounts. These are counts, not timing measurements.</p>
        </div>
        <button type="button" onClick={counts.reset}>
          Reset counts
        </button>
      </div>
      <dl className="count-grid" aria-labelledby="counts-heading">
        {countKeys.map((key) => (
          <div className="count-item" key={key}>
            <dt>{key}</dt>
            <dd data-count-key={key}>{snapshot[key] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function App() {
  const [counts] = useState(createRenderCountStore);

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">TanStack Form composition example</p>
        <h1>Keep unrelated field work isolated</h1>
        <p className="lede">
          Both panels use a real reactive form group. Change a first name twice: the original
          composition commits its sibling again, while the stable memo field set leaves the
          unrelated sibling alone and keeps the changed field live.
        </p>
      </header>

      <section className="tips" aria-label="How to compare">
        <p>
          Related validation starts off so the last name is unrelated. Turn it on to see the
          last-name error correctly update when its first-name dependency changes.
        </p>
      </section>

      <section className="panel-grid" aria-label="Form comparison">
        <DemoForm mode="original" counts={counts} />
        <DemoForm mode="isolated" counts={counts} />
      </section>

      <section className="counts-section" aria-labelledby="counts-heading">
        <RenderCountDashboard counts={counts} />
      </section>

      <footer>
        <p>Buy me a coffee — entirely optional:</p>
        <ul>
          <li>
            <strong>USDC / SOL · Solana:</strong>{' '}
            <code>9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy</code>
          </li>
          <li>
            <strong>USDC / ETH · Base:</strong>{' '}
            <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code>
          </li>
          <li>
            <strong>USDT · BNB Smart Chain (BEP20):</strong>{' '}
            <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code>
          </li>
        </ul>
      </footer>
    </main>
  );
}
