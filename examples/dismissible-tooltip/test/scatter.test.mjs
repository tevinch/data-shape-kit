import assert from "node:assert/strict";
import test from "node:test";

import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "../.compiled/App.js";
import { dispatchMouse, installDom, waitForAnimationFrame } from "./dom.mjs";

async function mountApp() {
  const environment = installDom();
  const root = createRoot(environment.container, { identifierPrefix: "scatter-" });
  await act(async () => {
    root.render(createElement(StrictMode, null, createElement(App)));
  });
  return {
    ...environment,
    async mouse(pointId, type) {
      const point = environment.container.querySelector(`[data-point-id="${pointId}"]`);
      assert.ok(point, `chart point ${pointId} exists`);
      await act(async () => dispatchMouse(point, type));
    },
    async click(selector) {
      const target = environment.container.querySelector(selector);
      assert.ok(target, `${selector} exists`);
      await act(async () => target.click());
      return target;
    },
    async close() {
      await act(async () => root.unmount());
      await waitForAnimationFrame(environment.dom);
      environment.restore();
    },
  };
}

function visibleTooltip(container) {
  return container.querySelector('[role="tooltip"]')?.textContent ?? null;
}

test("Scatter hover is dismissed by point details and rearms only on a different point", async () => {
  const view = await mountApp();
  try {
    await view.mouse("point-A", "mouseover");
    assert.match(visibleTooltip(view.container), /Point A/);

    await view.mouse("point-A", "click");
    assert.equal(visibleTooltip(view.container), null);
    assert.match(view.container.querySelector("dialog[open]")?.textContent ?? "", /Point A details/);

    await view.mouse("point-B", "mouseover");
    assert.equal(visibleTooltip(view.container), null, "modal suspension blocks rearming");

    await view.click("dialog button[data-close-details]");
    assert.equal(view.container.querySelector("dialog[open]"), null);
    assert.equal(visibleTooltip(view.container), null);

    await view.mouse("point-A", "mouseover");
    assert.equal(visibleTooltip(view.container), null);
    await view.mouse("point-B", "mouseover");
    assert.match(visibleTooltip(view.container), /Point B/);
    await view.mouse("point-B", "mouseout");
    assert.equal(visibleTooltip(view.container), null);
  } finally {
    await view.close();
  }
});

test("the HTML table offers keyboard-operable details and restores button focus", async () => {
  const view = await mountApp();
  try {
    const detailsButton = view.container.querySelector('button[data-details-id="point-C"]');
    assert.ok(detailsButton);
    detailsButton.focus();
    await act(async () => detailsButton.click());
    assert.match(view.container.querySelector("dialog[open]")?.textContent ?? "", /Point C details/);
    assert.equal(visibleTooltip(view.container), null);
    await view.click("dialog button[data-close-details]");
    assert.equal(document.activeElement, detailsButton);
  } finally {
    await view.close();
  }
});
