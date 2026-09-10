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
  let closed = false;
  let currentProps = initialProps;

  try {
    const [{ createElement, act }, { createRoot }, { SampledLineChart }, { sampleLine }] = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("./dist/SampledLineChart.js"),
      import("./dist/sample-line.js"),
    ]);
    const container = dom.window.document.getElementById(rootId);
    root = createRoot(container, { identifierPrefix: `${rootId}-` });

    const selectedFor = (props) => sampleLine(props.data, {
      x: (row) => row.x,
      y: (row) => row.y,
      maxPoints: props.maxPoints,
    }).data;
    let selectedData = selectedFor(currentProps);
    const render = async (nextProps) => {
      currentProps = nextProps;
      selectedData = selectedFor(currentProps);
      await act(async () => {
        root.render(createElement(SampledLineChart, currentProps));
      });
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
        if (closed) return;
        closed = true;
        await act(async () => root.unmount());
        await waitForAnimationFrame(dom);
        restoreGlobals();
        dom.window.close();
      },
    };
  } catch (error) {
    if (root !== undefined) {
      const { act } = await import("react");
      await act(async () => root.unmount());
      await waitForAnimationFrame(dom);
    }
    restoreGlobals();
    dom.window.close();
    throw error;
  }
}
