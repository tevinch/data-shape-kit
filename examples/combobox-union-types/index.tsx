import { Combobox } from '@headlessui/react'
type Option = { label: string; value: string; disabled?: boolean }
type Value = string | Option
const getValue = (o: Value) => typeof o === 'string' ? o : o.value
const compare = (a: Value, z: Value) => getValue(a) === getValue(z)
declare const multiple: boolean
declare const options: Option[]
export const example = <Combobox<Value, boolean>
  multiple={multiple}
  by={compare}
  virtual={{ options, disabled: (o: Value) => typeof o === 'object' && !!o.disabled }}
/>
