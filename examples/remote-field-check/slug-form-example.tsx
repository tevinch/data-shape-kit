import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import type { Control, UseFormRegister } from 'react-hook-form';
import type { RemoteChecker, RemoteCheckController, RemoteCheckOptions } from './remote-check.mjs';
import { useRemoteCheckController, useRemoteCheckState } from './use-remote-check.js';

export type SlugFormValues = { slug: string; note: string };
export interface SlugFormExampleProps extends RemoteCheckOptions {
  check: RemoteChecker;
  onAccepted: (values: SlugFormValues) => void | Promise<void>;
}

/** Shared local rule: do not spend remote work on values RHF will reject. */
export function validateSlug(value: string): true | string {
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(value)
    || 'Use 3–32 lowercase letters, digits or hyphens; start and end with a letter or digit.';
}

function SlugField({ register, control, remote }: {
  register: UseFormRegister<SlugFormValues>;
  control: Control<SlugFormValues>;
  remote: RemoteCheckController;
}) {
  const state = useRemoteCheckState(remote);
  const { errors } = useFormState({ control, name: 'slug', exact: true });
  const localError = errors.slug?.message;
  const field = register('slug', { validate: validateSlug });
  let message = '';
  if (localError) message = localError;
  else if (state.status === 'waiting') message = 'Waiting to check…';
  else if (state.status === 'checking') message = 'Checking…';
  else if (state.status === 'valid') message = 'Available at the time of this check.';
  else if (state.status === 'invalid') message = state.message;
  else if (state.status === 'error') message = 'Could not check availability. Please try again.';
  const invalid = Boolean(localError) || state.status === 'invalid' || state.status === 'error';
  return <div>
    <label htmlFor="remote-slug">Slug</label>
    <input {...field} id="remote-slug" aria-describedby="remote-slug-status" aria-invalid={invalid}
      onChange={(event) => {
        // Store the input immediately; debounce only the remote side effect.
        void field.onChange(event);
        const value = event.target.value;
        if (validateSlug(value) === true) void remote.schedule(value);
        else remote.cancel();
      }} />
    <p id="remote-slug-status" role="status" aria-live="polite">{message}</p>
  </div>;
}

/** Supply your own checker and actual operation; the server must validate again. */
export function SlugFormExample({ check, onAccepted, delayMs, timeoutMs }: SlugFormExampleProps) {
  const remote = useRemoteCheckController(check, { delayMs, timeoutMs });
  const { register, control, handleSubmit, getValues, reset, formState: { isSubmitting } } = useForm<SlugFormValues>({
    defaultValues: { slug: '', note: '' }, mode: 'onChange',
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const submit = handleSubmit(async (values) => {
    setSubmissionError(null);
    const outcome = await remote.checkNow(values.slug);
    // RHF's isValid covers local rules only. A previous successful check is not
    // sufficient, even when the user changes A to B and then back to A.
    if (outcome.status !== 'valid' || !remote.isCurrent(outcome) || getValues('slug') !== outcome.value) return;
    try {
      await onAccepted(values);
    } catch {
      setSubmissionError('Could not complete the submission. Please try again.');
    }
  });
  return <form onSubmit={submit} noValidate>
    <fieldset disabled={isSubmitting}>
      <legend>Choose a slug</legend>
      <SlugField register={register} control={control} remote={remote} />
      <div><label htmlFor="remote-note">Note</label><input {...register('note')} id="remote-note" /></div>
      <button type="submit">Check and continue</button>
      <button type="button" onClick={() => {
        remote.cancel();
        reset();
        setSubmissionError(null);
      }}>Reset</button>
    </fieldset>
    {submissionError && <p role="alert">{submissionError}</p>}
  </form>;
}
