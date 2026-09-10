import type { DeepKeysOfType } from '@tanstack/react-form';

export type PersonName = Readonly<{
  firstName: string;
  lastName: string;
}>;

export type DemoValues = Readonly<{
  profile: PersonName;
  backup: PersonName;
}>;

export type NameGroup = 'profile' | 'backup';
export type NamePart = 'firstName' | 'lastName';
export type TextFieldName = DeepKeysOfType<DemoValues, string>;

export type TextFieldDefinition = Readonly<{
  name: TextFieldName;
  group: NameGroup;
  part: NamePart;
  label: 'first name' | 'last name';
  disabled: boolean;
  relatedValidation: boolean;
}>;

export const defaultValues: DemoValues = Object.freeze({
  profile: Object.freeze({ firstName: 'Ada', lastName: 'Lee' }),
  backup: Object.freeze({ firstName: 'Grace', lastName: 'Hopper' }),
});

export function createTextFieldDefinitions(
  group: NameGroup,
  disabled: boolean,
  relatedValidation: boolean,
): readonly TextFieldDefinition[] {
  return Object.freeze([
    Object.freeze({
      name: `${group}.firstName` as TextFieldName,
      group,
      part: 'firstName' as const,
      label: 'first name' as const,
      disabled,
      relatedValidation,
    }),
    Object.freeze({
      name: `${group}.lastName` as TextFieldName,
      group,
      part: 'lastName' as const,
      label: 'last name' as const,
      disabled,
      relatedValidation,
    }),
  ]);
}
