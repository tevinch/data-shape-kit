import { createRemoteCheck } from '../remote-field-check/remote-check.mjs';

const STALE_MESSAGE = 'Value changed. Please validate again.';
const DEFAULT_ERROR_MESSAGE = 'Unable to validate. Please try again.';

export function createDebouncedRule(check, options) {
  if (typeof check !== 'function') throw new TypeError('check must be a function');
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const {
    getValue,
    isEligible,
    delayMs,
    timeoutMs,
    errorMessage = DEFAULT_ERROR_MESSAGE,
  } = options;
  if (typeof getValue !== 'function') throw new TypeError('getValue must be a function');
  if (typeof isEligible !== 'function') throw new TypeError('isEligible must be a function');
  if (typeof errorMessage !== 'string' || errorMessage.trim().length === 0) {
    throw new TypeError('errorMessage must be a nonblank string');
  }

  const controller = createRemoteCheck(check, { delayMs, timeoutMs });
  let immediateDepth = 0;

  const validator = async (_rule, value) => {
    if (getValue() !== value) throw new Error(STALE_MESSAGE);
    if (typeof value !== 'string' || !isEligible(value)) {
      controller.cancel();
      return;
    }

    const outcome = await (
      immediateDepth > 0 ? controller.checkNow(value) : controller.schedule(value)
    );
    if (!controller.isCurrent(outcome) || getValue() !== value) {
      throw new Error(STALE_MESSAGE);
    }
    if (outcome.status === 'invalid') throw new Error(outcome.message);
    if (outcome.status === 'error') throw new Error(errorMessage);
  };

  const runScope = async (callback) => {
    immediateDepth += 1;
    try {
      return await callback();
    } finally {
      immediateDepth -= 1;
    }
  };

  return Object.freeze({
    validator,
    runImmediately(callback) {
      if (typeof callback !== 'function') throw new TypeError('callback must be a function');
      return runScope(callback);
    },
    cancel: () => controller.cancel(),
  });
}
