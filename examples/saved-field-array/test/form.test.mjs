import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createElement } from "react";
import { deferred, installDom, setInputValue } from "./dom.mjs";

const restoreDom = installDom();
const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { SavedFieldArray } = await import("../.compiled/SavedFieldArray.js");

after(() => {
  restoreDom();
});

async function flushWork(turns = 2) {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  flushSync(() => {});
}

async function waitFor(check, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    await flushWork(1);
  }
  assert.fail(message);
}

async function mount(saveSnapshot, initialValues = initialRecords()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (nextSave = saveSnapshot, nextInitial = initialValues) => {
    flushSync(() => {
      root.render(
        createElement(SavedFieldArray, {
          initialValues: nextInitial,
          saveSnapshot: nextSave,
        }),
      );
    });
  };
  render();
  await flushWork();

  return {
    host,
    render,
    async cleanup() {
      flushSync(() => root.unmount());
      host.remove();
      await flushWork();
    },
  };
}

function initialRecords() {
  return {
    items: [
      { recordId: "record-A", name: "Apricot" },
      { recordId: "record-B", name: "Birch" },
    ],
  };
}

function byLabel(host, label) {
  const element = host.querySelector(`[aria-label="${label}"]`);
  assert.ok(element, `expected an element labelled ${label}`);
  return element;
}

function button(host, label) {
  const match = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  assert.ok(match, `expected a ${label} button`);
  return match;
}

async function edit(input, value) {
  setInputValue(input, value);
  await flushWork();
}

function submit(host) {
  host.querySelector("form").requestSubmit();
}

function baseline(host) {
  return byLabel(host, "Acknowledged baseline").textContent;
}

function formState(host) {
  return byLabel(host, "Form state").textContent;
}

test("successful acknowledgement cleans the form without replacing local controls", async () => {
  const request = deferred();
  const snapshots = [];
  const view = await mount((snapshot) => {
    snapshots.push(snapshot);
    return request.promise;
  });
  try {
    const name = byLabel(view.host, "Name 1");
    const note = byLabel(view.host, "Local note 1");
    const file = byLabel(view.host, "Local file 1");
    const suppliedFiles = { 0: new File(["notes"], "notes.txt"), length: 1 };
    Object.defineProperty(file, "files", { configurable: true, value: suppliedFiles });

    await edit(name, "Apricot pie");
    await edit(note, "keep this note");
    assert.match(formState(view.host), /unsaved/i);
    submit(view.host);
    await waitFor(() => snapshots.length === 1, "save callback was not invoked");

    request.resolve(structuredClone(snapshots[0]));
    await flushWork(4);

    assert.equal(byLabel(view.host, "Name 1").value, "Apricot pie");
    assert.ok(byLabel(view.host, "Local note 1") === note);
    assert.equal(note.value, "keep this note");
    assert.ok(byLabel(view.host, "Local file 1") === file);
    assert.ok(file.files === suppliedFiles);
    assert.match(formState(view.host), /clean/i);
    assert.match(byLabel(view.host, "Save status").textContent, /saved/i);
    assert.match(baseline(view.host), /Apricot pie/);
  } finally {
    await view.cleanup();
  }
});

test("an edit made during save stays visible and dirty against the acknowledged snapshot", async () => {
  const request = deferred();
  const snapshots = [];
  const view = await mount((snapshot) => {
    snapshots.push(snapshot);
    return request.promise;
  });
  try {
    const name = byLabel(view.host, "Name 1");
    await edit(name, "Apricot tart");
    name.focus();
    name.setSelectionRange(3, 8);
    submit(view.host);
    await waitFor(() => snapshots.length === 1, "save callback was not invoked");

    await edit(name, "Apricot jam");
    name.focus();
    name.setSelectionRange(4, 9);
    request.resolve(structuredClone(snapshots[0]));
    await flushWork(4);

    assert.ok(byLabel(view.host, "Name 1") === name);
    assert.equal(name.value, "Apricot jam");
    assert.equal(document.activeElement, name);
    assert.equal(name.selectionStart, 4);
    assert.equal(name.selectionEnd, 9);
    assert.match(formState(view.host), /unsaved/i);
    assert.match(baseline(view.host), /Apricot tart/);
    assert.doesNotMatch(baseline(view.host), /Apricot jam/);
    assert.match(name.closest("article").textContent, /unsaved/i);
  } finally {
    await view.cleanup();
  }
});

test("submission passes a detached snapshot captured before later edits", async () => {
  const request = deferred();
  const suppliedInitialValues = initialRecords();
  let outgoing;
  const view = await mount((snapshot) => {
    outgoing = snapshot;
    return request.promise;
  }, suppliedInitialValues);
  try {
    const name = byLabel(view.host, "Name 1");
    await edit(name, "Apricot tart");
    submit(view.host);
    await waitFor(() => Boolean(outgoing), "save callback was not invoked");

    assert.notEqual(outgoing, suppliedInitialValues);
    assert.notEqual(outgoing.items, suppliedInitialValues.items);
    assert.notEqual(outgoing.items[0], suppliedInitialValues.items[0]);
    assert.equal(outgoing.items[0].name, "Apricot tart");
    await edit(name, "Apricot jam");
    assert.equal(outgoing.items[0].name, "Apricot tart");

    request.resolve(structuredClone(outgoing));
    await flushWork(4);
  } finally {
    await view.cleanup();
  }
});

test("a synchronous guard excludes duplicate submissions while one save is pending", async () => {
  const request = deferred();
  const snapshots = [];
  const view = await mount((snapshot) => {
    snapshots.push(snapshot);
    return request.promise;
  });
  try {
    submit(view.host);
    submit(view.host);
    await waitFor(() => snapshots.length > 0, "save callback was not invoked");
    await flushWork(3);

    assert.equal(snapshots.length, 1);
    assert.equal(byLabel(view.host, "Save").disabled, true);
    request.resolve(structuredClone(snapshots[0]));
    await flushWork(4);
  } finally {
    await view.cleanup();
  }
});

test("a failed save preserves the baseline and permits a clean retry", async () => {
  const requests = [deferred(), deferred()];
  const snapshots = [];
  const view = await mount((snapshot) => {
    snapshots.push(snapshot);
    return requests[snapshots.length - 1].promise;
  });
  try {
    await edit(byLabel(view.host, "Name 1"), "Apricot pie");
    submit(view.host);
    await waitFor(() => snapshots.length === 1, "first save callback was not invoked");
    requests[0].reject(new Error("Temporary service failure"));
    await flushWork(4);

    assert.equal(byLabel(view.host, "Name 1").value, "Apricot pie");
    assert.match(formState(view.host), /unsaved/i);
    assert.match(baseline(view.host), /Apricot/);
    assert.doesNotMatch(baseline(view.host), /Apricot pie/);
    assert.match(byLabel(view.host, "Save status").textContent, /Temporary service failure/);

    submit(view.host);
    await waitFor(() => snapshots.length === 2, "retry save callback was not invoked");
    requests[1].resolve(structuredClone(snapshots[1]));
    await flushWork(4);

    assert.match(formState(view.host), /clean/i);
    assert.match(baseline(view.host), /Apricot pie/);
  } finally {
    await view.cleanup();
  }
});

test("an empty name shows a labelled error without invoking persistence", async () => {
  let calls = 0;
  const view = await mount(async (snapshot) => {
    calls += 1;
    return snapshot;
  });
  try {
    const name = byLabel(view.host, "Name 1");
    await edit(name, "");
    submit(view.host);
    await flushWork(5);

    assert.equal(calls, 0);
    assert.equal(name.getAttribute("aria-invalid"), "true");
    assert.match(view.host.querySelector('[role="alert"]').textContent, /name is required/i);
  } finally {
    await view.cleanup();
  }
});

test("retained rows keep identity when rows change during an older save", async () => {
  const requests = [deferred(), deferred()];
  const snapshots = [];
  const view = await mount((snapshot) => {
    snapshots.push(snapshot);
    return requests[snapshots.length - 1].promise;
  });
  try {
    const birchName = byLabel(view.host, "Name 2");
    const birchNote = byLabel(view.host, "Local note 2");
    const birchFile = byLabel(view.host, "Local file 2");
    await edit(birchNote, "retained row note");

    submit(view.host);
    await waitFor(() => snapshots.length === 1, "first save callback was not invoked");
    button(view.host, "Add row").click();
    await flushWork();
    await edit(byLabel(view.host, "Name 3"), "Cedar");
    button(view.host, "Remove row 1").click();
    await flushWork();

    requests[0].resolve(structuredClone(snapshots[0]));
    await flushWork(4);

    assert.ok(byLabel(view.host, "Name 1") === birchName);
    assert.ok(byLabel(view.host, "Local note 1") === birchNote);
    assert.ok(byLabel(view.host, "Local file 1") === birchFile);
    assert.equal(birchNote.value, "retained row note");
    assert.equal(view.host.querySelectorAll("article").length, 2);
    assert.equal(birchName.value, "Birch");
    assert.match(formState(view.host), /unsaved/i);

    submit(view.host);
    await waitFor(() => snapshots.length === 2, "second save callback was not invoked");
    assert.equal(snapshots[1].items.length, 2);
    assert.equal(snapshots[1].items[0].recordId, "record-B");
    assert.ok(!["record-A", "record-B"].includes(snapshots[1].items[1].recordId));
    requests[1].resolve(structuredClone(snapshots[1]));
    await flushWork(4);
  } finally {
    await view.cleanup();
  }
});

test("all rows can be removed and saved as an empty snapshot", async () => {
  const request = deferred();
  let outgoing;
  const view = await mount((snapshot) => {
    outgoing = snapshot;
    return request.promise;
  });
  try {
    button(view.host, "Remove row 1").click();
    await flushWork();
    button(view.host, "Remove row 1").click();
    await flushWork();
    assert.equal(view.host.querySelectorAll("article").length, 0);

    submit(view.host);
    await waitFor(() => Boolean(outgoing), "empty save callback was not invoked");
    assert.deepEqual(outgoing, { items: [] });
    request.resolve({ items: [] });
    await flushWork(4);
    assert.match(formState(view.host), /clean/i);
  } finally {
    await view.cleanup();
  }
});

test("initial value prop changes do not replace a live edit session", async () => {
  const saveSnapshot = async (snapshot) => snapshot;
  const view = await mount(saveSnapshot);
  try {
    const name = byLabel(view.host, "Name 1");
    await edit(name, "Live edit");
    view.render(saveSnapshot, {
      items: [{ recordId: "record-C", name: "Cherry" }],
    });
    await flushWork();

    assert.ok(byLabel(view.host, "Name 1") === name);
    assert.equal(name.value, "Live edit");
    assert.equal(view.host.querySelectorAll("article").length, 2);
  } finally {
    await view.cleanup();
  }
});

test("an application-owned request can settle after the component unmounts", async () => {
  const request = deferred();
  let outgoing;
  let transportCompleted = false;
  const view = await mount(async (snapshot) => {
    outgoing = snapshot;
    await request.promise;
    transportCompleted = true;
    return snapshot;
  });

  submit(view.host);
  await waitFor(() => Boolean(outgoing), "save callback was not invoked");
  await view.cleanup();
  request.resolve();
  await flushWork(4);

  assert.equal(transportCompleted, true);
});
