import type { ComponentType } from 'react';
import { createMemoFieldSet } from '../MemoFieldSet.js';

type Definition = Readonly<{
  name: 'profile.firstName' | 'profile.lastName';
  label: string;
  disabled: boolean;
}>;

const FieldSet = createMemoFieldSet<Definition>();
const Field: ComponentType<Definition> = ({ label }) => <span>{label}</span>;
const fields = [
  { name: 'profile.firstName', label: 'First name', disabled: false },
  { name: 'profile.lastName', label: 'Last name', disabled: false },
] as const satisfies readonly Definition[];

<FieldSet Field={Field} fields={fields} />;

// @ts-expect-error names stay within the literal field-name union
<FieldSet Field={Field} fields={[{ name: 'profile.nickname', label: 'Nickname', disabled: false }]} />;

// @ts-expect-error every custom definition property remains required
<FieldSet Field={Field} fields={[{ name: 'profile.firstName', label: 'First name' }]} />;

const IncompatibleField: ComponentType<{ name: number }> = () => null;
// @ts-expect-error a renderer must accept the complete definition
<FieldSet Field={IncompatibleField} fields={fields} />;
