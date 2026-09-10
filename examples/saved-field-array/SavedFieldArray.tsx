import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useFieldArray,
  useForm,
  useFormState,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

export type ItemValues = { recordId: string; name: string };
export type FormValues = { items: ItemValues[] };

type SavedFieldArrayProps = {
  initialValues: FormValues;
  saveSnapshot: (snapshot: FormValues) => Promise<FormValues>;
};

type SaveStatus =
  | { kind: "ready" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "invalid" }
  | { kind: "failed"; message: string };

function SavedRow({
  index,
  register,
  errors,
  dirty,
  remove,
}: {
  index: number;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<ItemValues> | undefined;
  dirty: boolean;
  remove: () => void;
}) {
  const [note, setNote] = useState("");
  const errorId = `item-${index}-name-error`;

  return (
    <article className="saved-row">
      <div className="row-heading">
        <h3>Row {index + 1}</h3>
        <span className={dirty ? "row-state is-dirty" : "row-state"}>
          {dirty ? "Unsaved" : "In baseline"}
        </span>
      </div>

      <input type="hidden" {...register(`items.${index}.recordId`)} />

      <label className="field-label" htmlFor={`item-${index}-name`}>
        Saved name
      </label>
      <input
        id={`item-${index}-name`}
        aria-label={`Name ${index + 1}`}
        aria-describedby={errors?.name ? errorId : undefined}
        aria-invalid={errors?.name ? "true" : "false"}
        {...register(`items.${index}.name`, {
          validate: (value) => value.trim().length > 0 || "Name is required.",
        })}
      />
      {errors?.name ? (
        <p className="field-error" id={errorId} role="alert">
          {errors.name.message}
        </p>
      ) : null}

      <div className="local-fields">
        <div>
          <label className="field-label" htmlFor={`item-${index}-note`}>
            Local note <span>(not saved)</span>
          </label>
          <input
            id={`item-${index}-note`}
            aria-label={`Local note ${index + 1}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`item-${index}-file`}>
            Local file <span>(not saved)</span>
          </label>
          <input
            id={`item-${index}-file`}
            aria-label={`Local file ${index + 1}`}
            type="file"
          />
        </div>
      </div>

      <button className="remove-button" type="button" onClick={remove}>
        Remove row {index + 1}
      </button>
    </article>
  );
}

function statusText(status: SaveStatus) {
  switch (status.kind) {
    case "saving":
      return "Saving this snapshot…";
    case "saved":
      return "Saved. The acknowledged snapshot is now the baseline.";
    case "invalid":
      return "Fix the labelled errors and try again.";
    case "failed":
      return `Save failed: ${status.message}`;
    default:
      return "Ready to save.";
  }
}

export function SavedFieldArray({ initialValues, saveSnapshot }: SavedFieldArrayProps) {
  const initialSnapshot = useRef<FormValues | null>(null);
  if (!initialSnapshot.current) {
    initialSnapshot.current = structuredClone(initialValues);
  }

  const { control, handleSubmit, register, resetDefaultValues } = useForm<FormValues>({
    defaultValues: initialSnapshot.current,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { dirtyFields, errors, isDirty } = useFormState({ control });
  const [acknowledged, setAcknowledged] = useState<FormValues>(() =>
    structuredClone(initialValues),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: "ready" });
  const [isSaving, setIsSaving] = useState(false);
  const submissionInFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runSubmission = handleSubmit(
    async (values) => {
      const snapshot = structuredClone(values);
      if (mounted.current) {
        setIsSaving(true);
        setStatus({ kind: "saving" });
      }

      try {
        const result = await saveSnapshot(snapshot);
        if (!mounted.current) return;

        const nextBaseline = structuredClone(result);
        resetDefaultValues(nextBaseline);
        setAcknowledged(structuredClone(nextBaseline));
        setStatus({ kind: "saved" });
      } catch (error) {
        if (!mounted.current) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "The save could not be completed.";
        setStatus({ kind: "failed", message });
      } finally {
        if (mounted.current) {
          submissionInFlight.current = false;
          setIsSaving(false);
        }
      }
    },
    () => {
      if (mounted.current) {
        submissionInFlight.current = false;
        setStatus({ kind: "invalid" });
      }
    },
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (submissionInFlight.current) {
      event.preventDefault();
      return;
    }

    submissionInFlight.current = true;
    void runSubmission(event).catch((error: unknown) => {
      if (!mounted.current) return;
      submissionInFlight.current = false;
      const message = error instanceof Error ? error.message : "The form could not be submitted.";
      setIsSaving(false);
      setStatus({ kind: "failed", message });
    });
  };

  return (
    <div className="saved-field-array">
      <form noValidate onSubmit={submit}>
        <div className="form-toolbar">
          <div>
            <p className="eyebrow">Editable records</p>
            <h2>Field array</h2>
          </div>
          <button
            className="add-button"
            type="button"
            onClick={() =>
              append(
                { recordId: crypto.randomUUID(), name: "" },
                { shouldFocus: true, focusName: `items.${fields.length}.name` },
              )
            }
          >
            Add row
          </button>
        </div>

        <div className="rows">
          {fields.map((field, index) => (
            <SavedRow
              key={field.id}
              index={index}
              register={register}
              errors={errors.items?.[index]}
              dirty={Boolean(dirtyFields.items?.[index])}
              remove={() => remove(index)}
            />
          ))}
          {fields.length === 0 ? (
            <p className="empty-state">No rows. Saving now acknowledges an empty list.</p>
          ) : null}
        </div>

        <div className="save-panel">
          <div>
            <p aria-label="Form state" className={isDirty ? "form-state is-dirty" : "form-state"}>
              {isDirty ? "Unsaved changes." : "Clean — current values match the acknowledged baseline."}
            </p>
            <p aria-label="Save status" className={`save-status ${status.kind}`} role="status">
              {statusText(status)}
            </p>
          </div>
          <button aria-label="Save" className="save-button" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <section aria-label="Acknowledged baseline" className="baseline-panel">
        <div>
          <p className="eyebrow">Last acknowledged</p>
          <h2>Baseline</h2>
        </div>
        <pre>{JSON.stringify(acknowledged, null, 2)}</pre>
      </section>
    </div>
  );
}
