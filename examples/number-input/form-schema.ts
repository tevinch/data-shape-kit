import { z } from 'zod';

import { optionalNumberInput, requiredNumberInput } from './number-input.js';

export const formSchema = z.object({
  count: requiredNumberInput.pipe(z.number().int().min(0).max(100)),
  measurement: optionalNumberInput.pipe(z.number().min(0).max(100).optional()),
});

export type FormInput = z.input<typeof formSchema>;
export type FormOutput = z.output<typeof formSchema>;
