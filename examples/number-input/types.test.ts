import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import type { FormInput, FormOutput } from './form-schema.js';
import { formSchema } from './form-schema.js';
import type { NumberInputValue } from './number-input.js';
import { optionalNumberInput, requiredNumberInput } from './number-input.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;

type OptionalInputIsExact = Expect<Equal<z.input<typeof optionalNumberInput>, NumberInputValue>>;
type OptionalOutputIsExact = Expect<Equal<z.output<typeof optionalNumberInput>, number | undefined>>;
type RequiredInputIsExact = Expect<Equal<z.input<typeof requiredNumberInput>, NumberInputValue>>;
type RequiredOutputIsExact = Expect<Equal<z.output<typeof requiredNumberInput>, number>>;
type FormInputIsExact = Expect<
  Equal<FormInput, { count?: NumberInputValue; measurement?: NumberInputValue }>
>;
type FormOutputIsExact = Expect<
  Equal<FormOutput, { count: number; measurement?: number | undefined }>
>;

const resolver: Resolver<FormInput, unknown, FormOutput> = zodResolver(formSchema);

declare const form: UseFormReturn<FormInput, unknown, FormOutput>;
const watchedCount: NumberInputValue = form.watch('count');
const stringDefaults: FormInput = { count: '', measurement: '' };

const wrongBooleanInput: FormInput = {
  // @ts-expect-error booleans are outside the schema input contract
  count: true,
};
const wrongStringOutput: FormOutput = {
  // @ts-expect-error parsed count is always a number
  count: '4',
};

void resolver;
void watchedCount;
void stringDefaults;
void wrongBooleanInput;
void wrongStringOutput;
export type {
  FormInputIsExact,
  FormOutputIsExact,
  OptionalInputIsExact,
  OptionalOutputIsExact,
  RequiredInputIsExact,
  RequiredOutputIsExact,
};
