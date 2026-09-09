import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { formSchema, type FormInput, type FormOutput } from './form-schema.js';

export function App() {
  const [submitted, setSubmitted] = useState<FormOutput | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    watch,
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      count: '',
      measurement: '',
    },
  });
  const liveValues = watch();

  const loadNumericValues = () => {
    setSubmitted(null);
    reset({ count: 0, measurement: 12.5 });
  };

  const resetToBlank = () => {
    setSubmitted(null);
    reset({ count: '', measurement: '' });
  };

  return (
    <main className="page-shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Typed Zod + React Hook Form example</p>
        <h1 id="page-title">Number Input</h1>
        <p>
          Keep editable text in the form, then validate it into finite numbers without
          turning a blank field into zero.
        </p>
      </section>

      <div className="demo-grid">
        <form
          className="form-card"
          onSubmit={handleSubmit(
            (values) => setSubmitted(values),
            () => setSubmitted(null),
          )}
          noValidate
        >
          <div className="field-group">
            <Controller
              name="count"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <label htmlFor="count">Required count</label>
                  <input
                    {...field}
                    id="count"
                    type="text"
                    inputMode="decimal"
                    value={field.value ?? ''}
                    onChange={(event) => {
                      setSubmitted(null);
                      field.onChange(event);
                    }}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? 'count-error' : undefined}
                  />
                  {fieldState.error && (
                    <p id="count-error" className="field-error" role="alert">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="field-group">
            <Controller
              name="measurement"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <label htmlFor="measurement">Optional measurement</label>
                  <input
                    {...field}
                    id="measurement"
                    type="text"
                    inputMode="decimal"
                    value={field.value ?? ''}
                    onChange={(event) => {
                      setSubmitted(null);
                      field.onChange(event);
                    }}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? 'measurement-error' : undefined}
                  />
                  {fieldState.error && (
                    <p id="measurement-error" className="field-error" role="alert">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <p className="form-note">
            Text inputs preserve partial or invalid text until the schema validates it.
          </p>

          <div className="button-row">
            <button type="submit" className="primary-button">
              Validate and submit
            </button>
            <button type="button" onClick={loadNumericValues}>
              Load numeric values
            </button>
            <button type="button" onClick={resetToBlank}>
              Reset to blank
            </button>
          </div>
        </form>

        <section className="results-card" aria-label="Form values">
          <div>
            <h2>Live form values</h2>
            <p>Raw values remain strings unless they were loaded programmatically.</p>
            <pre>{JSON.stringify(liveValues, null, 2)}</pre>
          </div>
          <div>
            <h2>Last valid submission</h2>
            <p>Only successfully parsed output appears here.</p>
            {submitted === null ? (
              <p className="empty-state">No submission yet.</p>
            ) : (
              <pre>{JSON.stringify(submitted, null, 2)}</pre>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
