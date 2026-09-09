import { z } from 'zod';

export type NumberInputValue = string | number | null | undefined;

export const optionalNumberInput = z.preprocess((value: NumberInputValue) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' ? undefined : Number(text);
  }
  return value;
}, z.number({ error: 'Enter a finite number.' }).optional());

export const requiredNumberInput = optionalNumberInput.pipe(z.number({ error: 'Enter a number.' }));
