import { useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useForm } from '@tanstack/react-form';
import { createMemoFieldSet } from './MemoFieldSet.js';
import {
  createTextFieldDefinitions,
  defaultValues,
} from './demo-model.js';
import type {
  DemoValues,
  NameGroup,
  TextFieldDefinition,
  TextFieldName,
} from './demo-model.js';
import { useCommittedRenderCount } from './render-counts.js';
import type { RenderCountStore } from './render-counts.js';

export type DemoMode = 'original' | 'isolated';

export type DemoFormProps = Readonly<{
  mode: DemoMode;
  counts: RenderCountStore;
}>;

const MemoTextFields = createMemoFieldSet<TextFieldDefinition>();

function validateName(value: string): string | undefined {
  if (value.trim().length === 0) return 'This name is required.';
  if (value.trim().length < 2) return 'Use at least 2 characters.';
  return undefined;
}

function FieldLeaf({
  countKey,
  disabled,
  errors,
  id,
  label,
  modeLabel,
  onBlur,
  onChange,
  value,
  counts,
}: Readonly<{
  countKey: string;
  disabled: boolean;
  errors: unknown[];
  id: string;
  label: string;
  modeLabel: string;
  onBlur(): void;
  onChange(value: string): void;
  value: string;
  counts: RenderCountStore;
}>) {
  useCommittedRenderCount(counts, countKey);
  const errorText = [...new Set(errors.map(String))].join(' ');
  const errorId = `${id}-error`;
  const part = countKey.endsWith('firstName') ? 'firstName' : 'lastName';

  return (
    <div className="field-row">
      <label htmlFor={id}>
        {modeLabel} {label}
      </label>
      <input
        id={id}
        aria-label={`${modeLabel} ${label}`}
        aria-describedby={errorId}
        aria-invalid={errorText.length > 0}
        disabled={disabled}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <p
        className="field-error"
        id={errorId}
        data-testid={`${modeLabel.toLowerCase()}-${part}-error`}
        aria-live="polite"
      >
        {errorText}
      </p>
    </div>
  );
}

function GroupView({
  children,
  canSubmit,
  counts,
  dirty,
  errors,
  mode,
  touched,
  valid,
  value,
}: Readonly<{
  children: ReactNode;
  canSubmit: boolean;
  counts: RenderCountStore;
  dirty: boolean;
  errors: unknown[];
  mode: DemoMode;
  touched: boolean;
  valid: boolean;
  value: unknown;
}>) {
  useCommittedRenderCount(counts, `${mode}.group`);
  return (
    <div className="group-view">
      {children}
      <p className="group-summary">
        Group: {dirty ? 'dirty' : 'pristine'}, {touched ? 'touched' : 'untouched'}, {valid ? 'valid' : 'invalid'}, {canSubmit ? 'can submit' : 'cannot submit'}
      </p>
      <p className="field-error" data-testid={`${mode}-group-error`} aria-live="polite">
        {errors.map(String).join(' ')}
      </p>
      <output data-testid={`${mode}-group-value`}>
        {JSON.stringify(value)}
      </output>
    </div>
  );
}

export function DemoForm({ mode, counts }: DemoFormProps) {
  const modeLabel = mode === 'original' ? 'Original' : 'Isolated';
  const [group, setGroup] = useState<NameGroup>('profile');
  const [disabled, setDisabled] = useState(false);
  const [relatedValidation, setRelatedValidation] = useState(false);
  const [parentRefresh, setParentRefresh] = useState(0);
  const [submission, setSubmission] = useState<{
    count: number;
    values: DemoValues;
  } | null>(null);
  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      setSubmission((current) => ({
        count: (current?.count ?? 0) + 1,
        values: value,
      }));
    },
  });
  const fields = useMemo(
    () => createTextFieldDefinitions(group, disabled, relatedValidation),
    [group, disabled, relatedValidation],
  );

  const BoundField = useMemo<ComponentType<TextFieldDefinition>>(() => {
    const TanStackField = form.Field;
    return function BoundTextField(definition) {
      const validate = ({ value }: { value: string }) => {
        const basicError = validateName(value);
        if (basicError) return basicError;
        if (
          definition.part === 'lastName' &&
          definition.relatedValidation &&
          value.trim() === form.state.values[definition.group].firstName.trim()
        ) {
          return 'First and last name must be different.';
        }
        return undefined;
      };
      const listenTo = definition.relatedValidation && definition.part === 'lastName'
        ? [`${definition.group}.firstName` as TextFieldName]
        : undefined;
      const id = `${mode}-${definition.name.replace('.', '-')}`;

      return (
        <TanStackField
          name={definition.name}
          validators={{
            onChange: validate,
            onBlur: validate,
            onSubmit: validate,
            onChangeListenTo: listenTo,
          }}
        >
          {(field) => (
            <FieldLeaf
              countKey={`${mode}.${definition.name}`}
              counts={counts}
              disabled={definition.disabled}
              errors={field.state.meta.errors}
              id={id}
              label={definition.label}
              modeLabel={modeLabel}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              value={field.state.value}
            />
          )}
        </TanStackField>
      );
    };
  }, [form.Field]);

  const reset = () => {
    form.reset();
    setSubmission(null);
  };

  return (
    <section className={`demo-panel ${mode}`} aria-labelledby={`${mode}-heading`}>
      <h2 id={`${mode}-heading`}>{modeLabel}</h2>
      <p>
        {mode === 'original'
          ? 'Fields are composed directly inside the reactive group callback.'
          : 'Stable field definitions cross a memo boundary; each field stays subscribed.'}
      </p>

      <form
        data-mode={mode}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="controls" aria-label={`${modeLabel} controls`}>
          <label>
            <input
              type="checkbox"
              aria-label={`${modeLabel}: Disable fields`}
              checked={disabled}
              onChange={(event) => setDisabled(event.currentTarget.checked)}
            />
            Disable fields
          </label>
          <label>
            <input
              type="checkbox"
              aria-label={`${modeLabel}: Use backup group`}
              checked={group === 'backup'}
              onChange={(event) =>
                setGroup(event.currentTarget.checked ? 'backup' : 'profile')
              }
            />
            Use backup group
          </label>
          <label>
            <input
              type="checkbox"
              aria-label={`${modeLabel}: Enable related validation`}
              checked={relatedValidation}
              onChange={(event) =>
                setRelatedValidation(event.currentTarget.checked)
              }
            />
            Enable related validation
          </label>
        </div>

        <form.FormGroup
          name={group}
          validators={{
            onChange: ({ value }) =>
              value.firstName.trim().length === 0 &&
              value.lastName.trim().length === 0
                ? 'Enter at least one name.'
                : undefined,
          }}
        >
          {(groupApi) => (
            <GroupView
              canSubmit={groupApi.state.meta.canSubmit}
              counts={counts}
              dirty={groupApi.state.meta.isDirty}
              errors={groupApi.state.meta.errors}
              mode={mode}
              touched={groupApi.state.meta.isTouched}
              valid={groupApi.state.meta.isValid}
              value={groupApi.state.value}
            >
              {mode === 'isolated' ? (
                <MemoTextFields Field={BoundField} fields={fields} />
              ) : (
                fields.map((definition) => (
                  <BoundField key={definition.name} {...definition} />
                ))
              )}
            </GroupView>
          )}
        </form.FormGroup>

        <div className="button-row">
          <button type="button" aria-label={`${modeLabel}: Reset values`} onClick={reset}>
            Reset values
          </button>
          <button
            type="button"
            aria-label={`${modeLabel}: Parent refresh`}
            onClick={() => setParentRefresh((value) => value + 1)}
          >
            Parent refresh
          </button>
          <button type="submit" aria-label={`${modeLabel}: Submit`}>
            Submit
          </button>
        </div>
      </form>

      <p>
        Parent refreshes: <output data-testid={`${mode}-parent-refresh`}>{parentRefresh}</output>
      </p>
      <output className="submit-result" data-testid={`${mode}-submit-result`}>
        {submission
          ? `Submission ${submission.count}: ${JSON.stringify(submission.values)}`
          : 'No successful submission yet.'}
      </output>
    </section>
  );
}
