import { createElement, memo } from 'react';
import type { ComponentType, NamedExoticComponent } from 'react';

export type NamedField = Readonly<{ name: string }>;

export type MemoFieldSetProps<T extends NamedField> = Readonly<{
  fields: readonly T[];
  Field: ComponentType<T>;
}>;

function validateDefinitions<T extends NamedField>(fields: readonly T[]): void {
  if (!Array.isArray(fields)) {
    throw new TypeError('fields must be an array');
  }

  const names = new Set<string>();
  for (const definition of fields) {
    if (
      definition === null ||
      typeof definition !== 'object' ||
      Array.isArray(definition)
    ) {
      throw new TypeError('each field definition must be a record');
    }
    if (
      typeof definition.name !== 'string' ||
      definition.name.trim().length === 0
    ) {
      throw new TypeError('each field name must be a nonempty string');
    }
    if (names.has(definition.name)) {
      throw new TypeError(`duplicate field name: ${definition.name}`);
    }
    names.add(definition.name);
  }
}

export function createMemoFieldSet<
  T extends NamedField,
>(): NamedExoticComponent<MemoFieldSetProps<T>> {
  const MemoFieldSet = memo(function FieldSet({
    Field,
    fields,
  }: MemoFieldSetProps<T>) {
    validateDefinitions(fields);
    return fields.map((definition) =>
      createElement(Field, { ...definition, key: definition.name }),
    );
  });
  MemoFieldSet.displayName = 'MemoFieldSet';
  return MemoFieldSet;
}
