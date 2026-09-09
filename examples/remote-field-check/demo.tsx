import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SlugFormExample } from './slug-form-example.js';
import type { SlugFormValues } from './slug-form-example.js';
import { demoCheck } from './demo-check.mjs';

function Demo() {
  const [accepted, setAccepted] = useState<SlugFormValues | null>(null);
  return <>
    <SlugFormExample check={demoCheck} delayMs={350} timeoutMs={1800}
      onAccepted={(values) => { setAccepted(values); }} />
    <section className="result" aria-labelledby="result-heading">
      <h2 id="result-heading">Last accepted values</h2>
      <p>Accepting only updates this panel. Nothing is sent or saved.</p>
      <pre aria-live="polite">{accepted ? JSON.stringify(accepted, null, 2) : 'No values accepted yet.'}</pre>
    </section>
  </>;
}

createRoot(document.getElementById('demo-root')!).render(<StrictMode><Demo /></StrictMode>);
