// Keep root CSS URLs for the web server, before file-system resolution.
export const cssRootUrls = {
  name: 'css-root-urls',
  setup(build) {
    build.onResolve({ filter: /^\//, namespace: 'file' }, args => {
      if (args.kind === 'url-token' || args.kind === 'import-rule') {
        return { path: args.path, external: true };
      }
    });
  },
};
