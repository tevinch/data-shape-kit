import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import CreatableSelect from 'react-select/creatable';
import {
  components,
  type GroupBase,
  type MultiValueGenericProps,
  type MultiValueRemoveProps,
  type OnChangeValue,
} from 'react-select';

import { appendTag, commitTagEdit } from './tag-edits.mjs';
import type { Tag, TagEdit } from './tag-edits.mjs';

export type EditableTagSelectProps = {
  value: readonly Tag[];
  onChange: (next: readonly Tag[]) => void;
  inputId: string;
  label: string;
  isDisabled?: boolean;
  createId?: () => string;
};

type EditContextValue = {
  openEditor: (tag: Tag) => void;
  selectDisabled: boolean;
};

const EditContext = createContext<EditContextValue | null>(null);
const EMPTY_OPTIONS: readonly Tag[] = [];

function getOptionLabel(tag: Tag) {
  return tag.text;
}

function getOptionValue(tag: Tag) {
  return tag.id;
}

function getNewOptionData(inputValue: string, optionLabel: ReactNode): Tag {
  return {
    id: '',
    text: typeof optionLabel === 'string' ? optionLabel : inputValue,
  };
}

function makeDefaultId() {
  return globalThis.crypto.randomUUID();
}

function stopMousePropagation(event: MouseEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function stopTouchPropagation(event: TouchEvent<HTMLButtonElement>) {
  event.stopPropagation();
}

function EditableMultiValueLabel(
  props: MultiValueGenericProps<Tag, true, GroupBase<Tag>>,
) {
  const editContext = useContext(EditContext);
  const tag = props.data as Tag;

  return (
    <components.MultiValueLabel {...props}>
      <button
        type="button"
        className="editable-tags__edit-button"
        aria-label={`Edit tag: ${tag.text}`}
        data-tag-id={tag.id}
        disabled={!editContext || editContext.selectDisabled}
        onMouseDown={stopMousePropagation}
        onTouchStart={stopTouchPropagation}
        onClick={(event) => {
          event.stopPropagation();
          editContext?.openEditor(tag);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') {
            event.stopPropagation();
          }
        }}
      >
        {tag.text}
      </button>
    </components.MultiValueLabel>
  );
}

function GuardedMultiValueRemove(
  props: MultiValueRemoveProps<Tag, true, GroupBase<Tag>>,
) {
  const editContext = useContext(EditContext);
  if (!editContext || editContext.selectDisabled) {
    return null;
  }
  return <components.MultiValueRemove {...props} />;
}

const SELECT_COMPONENTS = {
  MultiValueLabel: EditableMultiValueLabel,
  MultiValueRemove: GuardedMultiValueRemove,
};

export function EditableTagSelect({
  value,
  onChange,
  inputId,
  label,
  isDisabled = false,
  createId = makeDefaultId,
}: EditableTagSelectProps): React.JSX.Element {
  const [edit, setEdit] = useState<TagEdit | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const restoreTagIdRef = useRef<string | null>(null);
  const selectDisabled = isDisabled || edit !== null;
  const editorId = `${inputId}-tag-editor`;
  const errorId = `${inputId}-tag-error`;
  const labelId = `${inputId}-label`;

  const openEditor = useCallback(
    (tag: Tag) => {
      if (isDisabled) {
        return;
      }
      setEdit((current) =>
        current ?? { id: tag.id, originalText: tag.text, draft: tag.text },
      );
      setEditError(null);
      setCreateError(null);
    },
    [isDisabled],
  );

  const editContext = useMemo(
    () => ({ openEditor, selectDisabled }),
    [openEditor, selectDisabled],
  );

  useEffect(() => {
    if (edit !== null) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [edit?.id, edit?.originalText]);

  useEffect(() => {
    if (edit !== null || restoreTagIdRef.current === null) {
      return;
    }

    const tagId = restoreTagIdRef.current;
    restoreTagIdRef.current = null;
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>(
      '.editable-tags__edit-button',
    );
    const target = buttons
      ? [...buttons].find((button) => button.dataset.tagId === tagId)
      : undefined;
    (target ?? document.getElementById(inputId))?.focus();
  }, [edit, inputId, value]);

  const closeEditor = useCallback((tagId: string) => {
    restoreTagIdRef.current = tagId;
    setEdit(null);
    setEditError(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (edit === null || isDisabled) {
      return;
    }

    const result = commitTagEdit(value, edit);
    if (!result.ok) {
      setEditError(result.message);
      return;
    }

    if (result.changed) {
      onChange(result.value);
    }
    closeEditor(edit.id);
  }, [closeEditor, edit, isDisabled, onChange, value]);

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Tab') {
        return;
      }
      event.stopPropagation();

      const composing =
        event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
      if (composing) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        saveEdit();
      } else if (event.key === 'Escape' && edit !== null) {
        event.preventDefault();
        closeEditor(edit.id);
      }
    },
    [closeEditor, edit, saveEdit],
  );

  const handleSelectChange = useCallback(
    (next: OnChangeValue<Tag, true>) => {
      if (selectDisabled) {
        return;
      }
      setCreateError(null);
      onChange(next);
    },
    [onChange, selectDisabled],
  );

  const handleCreate = useCallback(
    (text: string) => {
      if (selectDisabled) {
        return;
      }

      const result = appendTag(value, createId(), text);
      if (!result.ok) {
        setCreateError(result.message);
        return;
      }
      setCreateError(null);
      onChange(result.value);
    },
    [createId, onChange, selectDisabled, value],
  );

  return (
    <div className="editable-tags" ref={rootRef}>
      <label className="editable-tags__label" id={labelId} htmlFor={inputId}>
        {label}
      </label>
      <EditContext.Provider value={editContext}>
        <CreatableSelect<Tag, true>
          aria-labelledby={labelId}
          className="editable-tags__select"
          classNamePrefix="editable-tags-select"
          components={SELECT_COMPONENTS}
          getNewOptionData={getNewOptionData}
          getOptionLabel={getOptionLabel}
          getOptionValue={getOptionValue}
          inputId={inputId}
          instanceId={inputId}
          isDisabled={selectDisabled}
          isMulti
          onChange={handleSelectChange}
          onCreateOption={handleCreate}
          options={EMPTY_OPTIONS}
          placeholder="Type a tag and press Enter"
          value={value}
        />
      </EditContext.Provider>

      {createError ? (
        <p className="editable-tags__error" role="alert">
          {createError}
        </p>
      ) : null}

      {edit ? (
        <div className="editable-tags__editor">
          <label className="editable-tags__editor-label" htmlFor={editorId}>
            Tag text
          </label>
          <input
            ref={editorRef}
            id={editorId}
            className="editable-tags__editor-input"
            type="text"
            value={edit.draft}
            disabled={isDisabled}
            aria-describedby={editError ? errorId : undefined}
            aria-invalid={editError ? true : undefined}
            onChange={(event) => {
              setEdit((current) =>
                current ? { ...current, draft: event.target.value } : current,
              );
              setEditError(null);
            }}
            onKeyDown={handleEditorKeyDown}
          />
          {editError ? (
            <p className="editable-tags__error" id={errorId} role="alert">
              {editError}
            </p>
          ) : null}
          <div className="editable-tags__editor-actions">
            <button
              type="button"
              data-action="save-tag"
              disabled={isDisabled}
              onClick={saveEdit}
            >
              Save tag
            </button>
            <button
              type="button"
              data-action="cancel-edit"
              onClick={() => closeEditor(edit.id)}
            >
              Cancel edit
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
