import { useCallback, useState } from "react";
import { SavedFieldArray, type FormValues } from "./SavedFieldArray";

const initialValues: FormValues = {
  items: [
    { recordId: "record-A", name: "Apricot" },
    { recordId: "record-B", name: "Birch" },
  ],
};

export function App() {
  const [failNextSave, setFailNextSave] = useState(false);

  const saveSnapshot = useCallback(
    async (snapshot: FormValues) => {
      const failThisRequest = failNextSave;
      if (failThisRequest) setFailNextSave(false);

      await new Promise((resolve) => setTimeout(resolve, 4_000));
      if (failThisRequest) {
        throw new Error("The demo save was set to fail. Your edits are still here.");
      }
      return snapshot;
    },
    [failNextSave],
  );

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">React Hook Form integration</p>
        <h1>Save a field array without remounting its rows</h1>
        <p className="hero-copy">
          This example acknowledges a saved snapshot as the new default while keeping the current
          inputs, row identity, and later edits in place.
        </p>
        <div className="try-it">
          <p>
            Edit a saved name, choose <strong>Save</strong>, then keep typing during the four-second
            wait. When the save finishes, the later edit remains visible and unsaved against the
            acknowledged baseline.
          </p>
          <label className="failure-switch">
            <input
              type="checkbox"
              checked={failNextSave}
              onChange={(event) => setFailNextSave(event.target.checked)}
            />
            Fail the next save
          </label>
        </div>
      </header>

      <SavedFieldArray initialValues={initialValues} saveSnapshot={saveSnapshot} />

      <footer className="coffee-footer">
        <p>
          This example is free. If it helped, an optional small coffee contribution is welcome;
          there is no obligation. Feedback is welcome too.
        </p>
        <ul>
          <li>
            <strong>USDC / SOL · Solana:</strong>{" "}
            <code>9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy</code>
          </li>
          <li>
            <strong>USDC / ETH · Base:</strong>{" "}
            <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code>
          </li>
          <li>
            <strong>USDT · BNB Smart Chain (BEP20):</strong>{" "}
            <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code>
          </li>
        </ul>
      </footer>
    </main>
  );
}
