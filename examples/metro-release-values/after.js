// Arithmetic and addition cases adapted from jormaj's Metro #1927 report.
const SHAPE = { lo: 80, hi: 85, scale: 2.8 };
function span() {
  const lo = SHAPE.lo;
  const hi = SHAPE.hi;
  const scale = SHAPE.scale;
  return (hi - lo) * scale;
}

const O = { e: 80 };
function increment() {
  const e = O.e;
  return e + 1;
}

const FLAGS = { enabled: false };
function label() {
  const enabled = FLAGS.enabled;
  return enabled ? 'on' : 'off';
}

const ALIASED = { e: 80 };
function renamed() {
  const amount = ALIASED.e;
  return amount + 1;
}

// Controls: parameter destructuring and repeated references.
function fromParameter(value) {
  const { e } = value;
  return e + 1;
}
const REPEATED = { e: 80 };
function twice() {
  const { e } = REPEATED;
  return e + e;
}

globalThis.releaseValues = {
  span: span(),
  increment: increment(),
  label: label(),
  renamed: renamed(),
  fromParameter: fromParameter({ e: 80 }),
  twice: twice(),
  production: !__DEV__,
};
