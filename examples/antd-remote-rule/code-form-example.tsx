// Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Form, Input } from 'antd';
import type { FormInstance } from 'antd';
import { createDebouncedRule } from './debounced-rule.mjs';
import type { RemoteChecker, RemoteCheckOptions } from '../remote-field-check/remote-check.mjs';

export type CodeValues = { code: string };
export const CODE_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;

/** Keep checkCode stable (a module function or useCallback). One rule per field. */
export function useCodeRule(form: FormInstance<CodeValues>, checkCode: RemoteChecker, options: RemoteCheckOptions = {}) {
  const { delayMs = 300, timeoutMs = 10000 } = options;
  const rule = useMemo(() => createDebouncedRule(checkCode, {
    getValue: () => form.getFieldValue('code'),
    isEligible: value => CODE_PATTERN.test(value),
    delayMs,
    timeoutMs,
  }), [form, checkCode, delayMs, timeoutMs]);
  useEffect(() => () => rule.cancel(), [rule]);
  return rule;
}

export interface CodeFormProps extends RemoteCheckOptions {
  checkCode: RemoteChecker;
  onValid: (values: CodeValues) => void | Promise<void>;
}

/** All submissions use validateFields inside the immediate-validation scope. */
export function CodeForm({ checkCode, onValid, delayMs, timeoutMs }: CodeFormProps) {
  const [form] = Form.useForm<CodeValues>();
  const rule = useCodeRule(form, checkCode, { delayMs, timeoutMs });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef(0);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; attempt.current++; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const current = ++attempt.current;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      const values = await rule.runImmediately(() => form.validateFields());
      if (!mounted.current || current !== attempt.current || values.code !== form.getFieldValue('code')) return;
      try { await onValid(values); }
      catch {
        if (mounted.current && current === attempt.current) setMessage('Could not complete the submission. Please try again.');
      }
    } catch {
      // Form owns field errors. A cancelled or out-of-date validation cannot submit.
    } finally {
      if (mounted.current && current === attempt.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function replaceValue(value?: string) {
    attempt.current++;
    rule.cancel();
    if (value === undefined) form.resetFields();
    else form.setFieldValue('code', value);
    busyRef.current = false;
    setBusy(false);
    setMessage('');
  }

  return <form aria-label="Entity code form" onSubmit={submit} noValidate>
    <Form form={form} component={false} initialValues={{ code: '' }}>
      <fieldset disabled={busy}>
        <legend>Choose an entity code</legend>
        <Form.Item name="code" label="Entity code" validateFirst="parallel" rules={[
          { required: true, whitespace: true, message: 'Code is required' },
          { pattern: CODE_PATTERN, message: 'Use 3–32 lowercase letters, digits or hyphens, starting with a letter.' },
          { validator: rule.validator },
        ]}>
          <Input autoComplete="off" />
        </Form.Item>
        <button type="submit">Check and continue</button>
      </fieldset>
      <button type="button" onClick={() => replaceValue()}>Reset</button>
      <button type="button" onClick={() => replaceValue('sample-code')}>Use sample code</button>
    </Form>
    {message && <p role="alert">{message}</p>}
  </form>;
}
