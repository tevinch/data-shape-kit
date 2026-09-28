import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm, revalidateLogic } from '@tanstack/react-form';

function Example({ scenario }) {
  const counts = useRef({ field: 0, form: 0, invalid: 0, saves: 0 });
  const [saved, setSaved] = useState(null);
  const [, refresh] = useState(0);
  const dynamic = scenario === 'dynamic';
  const mixed = scenario === 'mixed' || dynamic;
  const cause = dynamic ? 'onDynamic' : 'onSubmit';
  const validate = ({ value }) => {
    counts.current.form++;
    const fields = {};
    if (!value.a) fields.a = 'Form: name is required';
    if (!value.b) fields.b = 'Form: detail is required';
    return Object.keys(fields).length ? { fields } : undefined;
  };
  const form = useForm({
    defaultValues: { a: '', b: '' }, canSubmitWhenInvalid: true,
    ...(dynamic ? { validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }) } : {}),
    validators: scenario === 'blur' ? { onBlur: validate, onChange: validate, onSubmit: validate } : { [cause]: validate },
    onSubmitInvalid: () => { counts.current.invalid++; },
    onSubmit: ({ value }) => { counts.current.saves++; setSaved({ ...value }); },
  });
  return <>
    <p>{mixed ? 'Submit both empty fields. Both errors should appear. Correct the name, submit, then correct the detail and save.' : scenario === 'blur' ? 'Fill the name and blur it. Fill the detail, then submit once. The current values should save.' : 'Fill the name and submit with the detail empty. Clear the name and submit again. Both errors should appear. Correct both fields and save.'}</p>
    <form onSubmit={async event => { event.preventDefault(); await form.handleSubmit(); refresh(n => n + 1); }}>
      <form.Field name="a" validators={mixed ? { [cause]: ({ value }) => { counts.current.field++; return value ? undefined : 'Field: name is required'; } } : undefined}>
        {field => <label>Name (a)<input name="a" value={field.state.value} onChange={e => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><span role="status">{field.state.meta.errors.join('; ')}</span></label>}
      </form.Field>
      <form.Field name="b">
        {field => <label>Detail (b)<input name="b" value={field.state.value} onChange={e => field.handleChange(e.target.value)} onBlur={field.handleBlur} /><span role="status">{field.state.meta.errors.join('; ')}</span></label>}
      </form.Field>
      <form.Subscribe selector={state => state.isSubmitting}>{busy => <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save'}</button>}</form.Subscribe>
    </form>
    <h2>Saved values</h2><pre aria-label="Saved values">{saved ? JSON.stringify(saved, null, 2) : 'No save yet'}</pre>
    <h2>Current state</h2>
    <form.Subscribe selector={state => state}>{state => <pre aria-label="Current state">{JSON.stringify({ values: state.values, aErrors: state.fieldMeta.a?.errors, bErrors: state.fieldMeta.b?.errors, counts: counts.current, isSubmitting: state.isSubmitting, isSubmitSuccessful: state.isSubmitSuccessful }, null, 2)}</pre>}</form.Subscribe>
  </>;
}

function App() {
  const [scenario, setScenario] = useState('form');
  return <main><h1>Complete submit validation</h1><p>TanStack Form 1.33.5 · {__MODE__} · canSubmitWhenInvalid: true</p>
    <nav><a href="?mode=original">Original package</a> · <a href="?mode=patched">Patched package</a></nav>
    <label>Scenario<select value={scenario} onChange={e => setScenario(e.target.value)}><option value="form">Repeated form-only submit</option><option value="mixed">Mixed field and form validation</option><option value="dynamic">Dynamic mixed validation</option><option value="blur">Stale blur error</option></select></label>
    <Example key={scenario} scenario={scenario} />
    <p>This comparison saves only in this page's memory. Reloading clears it.</p>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
