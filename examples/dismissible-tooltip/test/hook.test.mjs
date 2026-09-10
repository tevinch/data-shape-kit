import assert from "node:assert/strict";
import test from "node:test";

import { act, createElement, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { useDismissibleTooltip } from "../.compiled/useDismissibleTooltip.js";
import { installDom } from "./dom.mjs";

function HookFixture({ suspended = false, apiRef, name = "fixture" }) {
  const tooltip = useDismissibleTooltip({ suspended });
  const [hoveredId, setHoveredId] = useState("point-A");

  useEffect(() => {
    apiRef.current = tooltip;
  });

  const enter = (id) => {
    tooltip.enter(id);
    setHoveredId(id);
  };

  return createElement(
    "section",
    { "data-fixture": name },
    tooltip.active !== false && hoveredId !== null
      ? createElement("output", { "data-tooltip": name }, `Tooltip ${hoveredId}`)
      : null,
    createElement("button", { onClick: () => tooltip.dismiss("point-A") }, "Dismiss A"),
    createElement("button", { onClick: () => enter("point-A") }, "Enter A"),
    createElement("button", { onClick: () => enter("point-B") }, "Enter B"),
    createElement("button", { onClick: tooltip.reset }, "Reset"),
  );
}

async function mountFixture(props) {
  const environment = installDom();
  const root = createRoot(environment.container, { identifierPrefix: "hook-" });
  const apiRef = { current: null };
  const render = async (nextProps) => {
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(HookFixture, { ...nextProps, apiRef })));
    });
  };
  await render(props);
  return {
    ...environment,
    apiRef,
    render,
    async click(label) {
      const button = [...environment.container.querySelectorAll("button")]
        .find((candidate) => candidate.textContent === label);
      assert.ok(button, `button ${label} exists`);
      await act(async () => button.click());
    },
    async close() {
      await act(async () => root.unmount());
      environment.restore();
    },
  };
}

function tooltipText(container, name = "fixture") {
  return container.querySelector(`[data-tooltip="${name}"]`)?.textContent ?? null;
}

test("dismisses one stable ID until a different ID enters", async () => {
  const view = await mountFixture({});
  try {
    assert.equal(tooltipText(view.container), "Tooltip point-A");
    await view.click("Dismiss A");
    assert.equal(tooltipText(view.container), null);
    await view.click("Dismiss A");
    await view.click("Enter A");
    assert.equal(tooltipText(view.container), null);
    await view.click("Enter B");
    assert.equal(tooltipText(view.container), "Tooltip point-B");
  } finally {
    await view.close();
  }
});

test("suspension keeps the stored dismissal until a later different enter", async () => {
  const view = await mountFixture({});
  try {
    await view.click("Dismiss A");
    await view.render({ suspended: true });
    await view.click("Enter B");
    assert.equal(tooltipText(view.container), null);
    assert.equal(view.apiRef.current.dismissedId, "point-A");
    await view.render({ suspended: false });
    assert.equal(tooltipText(view.container), null);
    await view.click("Enter B");
    assert.equal(tooltipText(view.container), "Tooltip point-B");
  } finally {
    await view.close();
  }
});

test("reset clears dismissal while suspension still hides rendered content", async () => {
  const view = await mountFixture({ suspended: true });
  try {
    await act(async () => view.apiRef.current.dismiss("point-A"));
    await view.click("Reset");
    assert.equal(view.apiRef.current.dismissedId, null);
    assert.equal(tooltipText(view.container), null);
    await view.render({ suspended: false });
    assert.equal(tooltipText(view.container), "Tooltip point-A");
  } finally {
    await view.close();
  }
});

test("keeps state local to each StrictMode hook instance", async () => {
  const environment = installDom();
  const root = createRoot(environment.container, { identifierPrefix: "pair-" });
  const first = { current: null };
  const second = { current: null };
  try {
    await act(async () => {
      root.render(createElement(StrictMode, null,
        createElement(HookFixture, { apiRef: first, name: "first" }),
        createElement(HookFixture, { apiRef: second, name: "second" }),
      ));
    });
    await act(async () => first.current.dismiss("point-A"));
    assert.equal(tooltipText(environment.container, "first"), null);
    assert.equal(tooltipText(environment.container, "second"), "Tooltip point-A");
  } finally {
    await act(async () => root.unmount());
    environment.restore();
  }
});

test("compares IDs exactly and rejects non-string or empty IDs", async () => {
  const view = await mountFixture({});
  try {
    await act(async () => view.apiRef.current.dismiss(" point-A"));
    assert.equal(view.apiRef.current.dismissedId, " point-A");
    await act(async () => view.apiRef.current.enter("point-A"));
    assert.equal(view.apiRef.current.dismissedId, null);
    assert.throws(() => view.apiRef.current.dismiss(""), TypeError);
    assert.throws(() => view.apiRef.current.enter(1), TypeError);
  } finally {
    await view.close();
  }
});
