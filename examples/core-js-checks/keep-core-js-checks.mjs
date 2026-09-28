export function keepCoreJsChecks() {
  return {
    name: 'keep-core-js-checks',
    transform(code, id) {
      if (/[/\\]node_modules[/\\]core-js[/\\]/.test(id)) {
        return { code, map: null, moduleSideEffects: 'no-treeshake' };
      }
      return null;
    },
  };
}
