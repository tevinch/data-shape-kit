import { JSDOM } from "jsdom";

const globalNames = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLDialogElement",
  "SVGElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "FocusEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
];

export function installDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
  });
  const previous = new Map(
    globalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );

  const values = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLDialogElement: dom.window.HTMLDialogElement,
    SVGElement: dom.window.SVGElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    FocusEvent: dom.window.FocusEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };

  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  const dialogPrototype = dom.window.HTMLDialogElement.prototype;
  if (typeof dialogPrototype.showModal !== "function") {
    dialogPrototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }
  if (typeof dialogPrototype.close !== "function") {
    dialogPrototype.close = function close(returnValue = "") {
      this.returnValue = returnValue;
      this.removeAttribute("open");
      this.dispatchEvent(new dom.window.Event("close"));
    };
  }

  return {
    dom,
    container: dom.window.document.getElementById("root"),
    restore() {
      for (const name of globalNames) {
        const descriptor = previous.get(name);
        if (descriptor === undefined) delete globalThis[name];
        else Object.defineProperty(globalThis, name, descriptor);
      }
      dom.window.close();
    },
  };
}

export function dispatchMouse(target, type, options = {}) {
  target.dispatchEvent(new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  }));
}

export function waitForAnimationFrame(dom) {
  return new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve()));
}
