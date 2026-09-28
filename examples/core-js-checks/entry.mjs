import 'core-js/modules/es.object.is-extensible.js';
import 'core-js/modules/es.object.is-frozen.js';
import 'core-js/modules/es.object.is-sealed.js';
import 'core-js/modules/es.object.get-prototype-of.js';

const unusedMessage = 'UNUSED_APPLICATION_SENTINEL';

export function primitiveResults() {
  return [
    Object.isExtensible(1),
    Object.isFrozen(1),
    Object.isSealed(1),
    Object.getPrototypeOf(1) === Number.prototype,
  ];
}

export function objectResults() {
  const open = {};
  const frozen = Object.freeze({});
  return [
    Object.isExtensible(open),
    Object.isFrozen(open),
    Object.isSealed(open),
    Object.isExtensible(frozen),
    Object.isFrozen(frozen),
    Object.isSealed(frozen),
    Object.getPrototypeOf(open) === Object.prototype,
  ];
}
