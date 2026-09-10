import { JSDOM } from "jsdom";

const globalNames = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "SVGElement",
  "Element",
  "Node",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
];

function installDomGlobals(dom) {
  const previous = new Map(globalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    SVGElement: dom.window.SVGElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  return () => {
    for (const name of globalNames) {
      const descriptor = previous.get(name);
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  };
}

function waitForAnimationFrame(dom) {
  return new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
}

export async function mountSampledLineChart(initialProps, { rootId = "line-chart" } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="${rootId}"></div></body></html>`, {
    pretendToBeVisual: true,
  });
  const restoreGlobals = installDomGlobals(dom);
  let root;
  let reactAct;
  let cleanupPromise;
  let currentProps = initialProps;

  const cleanup = () => {
    if (cleanupPromise !== undefined) return cleanupPromise;
    cleanupPromise = (async () => {
      const errors = [];
      const attempt = async (operation) => {
        try {
          await operation();
        } catch (error) {
          errors.push(error);
        }
      };

      if (root !== undefined && reactAct !== undefined) {
        await attempt(() => reactAct(async () => root.unmount()));
        await attempt(() => waitForAnimationFrame(dom));
      }
      await attempt(() => restoreGlobals());
      await attempt(() => dom.window.close());
      return errors;
    })();
    return cleanupPromise;
  };

  const throwCleanupErrors = (errors) => {
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Chart cleanup failed");
  };

  try {
    const [{ createElement, act }, { createRoot }, { SampledLineChart }, { sampleLine }] = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("./dist/SampledLineChart.js"),
      import("./dist/sample-line.js"),
    ]);
    reactAct = act;
    const container = dom.window.document.getElementById(rootId);
    root = createRoot(container, { identifierPrefix: `${rootId}-` });

    const selectedFor = (props) => sampleLine(props.data, {
      x: (row) => row.x,
      y: (row) => row.y,
      maxPoints: props.maxPoints,
    }).data;
    let selectedData;
    const render = async (nextProps) => {
      currentProps = nextProps;
      await act(async () => {
        root.render(createElement(SampledLineChart, currentProps));
      });
      selectedData = selectedFor(currentProps);
    };
    await render(currentProps);

    return {
      dom,
      container,
      get selectedData() {
        return selectedData;
      },
      render,
      async close() {
        throwCleanupErrors(await cleanup());
      },
    };
  } catch (renderError) {
    const cleanupErrors = await cleanup();
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [renderError, ...cleanupErrors],
        "Chart rendering and cleanup failed",
        { cause: renderError },
      );
    }
    throw renderError;
  }
}
