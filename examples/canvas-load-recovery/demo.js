import { StaticCanvas, Rect } from './node_modules/fabric/dist/index.mjs';
import { loadDocument } from './load-document.js';

const canvas = new StaticCanvas('canvas', { backgroundColor: '#ffffff', enableRetinaScaling: false });
canvas.add(new Rect({ originX: 'left', originY: 'top', left: 30, top: 30, width: 80, height: 80, fill: '#cf3d3d' }));
canvas.requestRenderAll();
const $ = (id) => document.getElementById(id);
const controls = ['valid', 'missing', 'unknown', 'pending', 'add', 'remove', 'render', 'automatic'];
let controller;
let square;

async function load(kind) {
  if (controller) return;
  controller = new AbortController();
  controls.forEach((id) => { $(id).disabled = true; });
  $('cancel').disabled = false;
  $('status').textContent = 'Loading. Editing is paused until this operation settles.';
  const id = `demo-${Date.now()}`;
  const documents = {
    valid: { background: '#ffffff', objects: [{ type: 'Rect', originX: 'left', originY: 'top', left: 280, top: 30, width: 80, height: 80, fill: '#278447' }] },
    unknown: { objects: [{ type: 'NotRegistered' }] },
    missing: { objects: [{ type: 'Image', src: `/missing.png?id=${id}`, width: 80, height: 80 }] },
    pending: { objects: [{ type: 'Image', src: `/pending.png?id=${id}`, width: 80, height: 80 }] },
  };
  try {
    const result = await loadDocument(canvas, documents[kind], controller.signal);
    $('status').textContent = result.status === 'loaded'
      ? 'Loaded. You can continue editing.'
      : result.status === 'cancelled'
        ? 'Cancelled. This fixture kept the previous document. You can edit or retry.'
        : `Load failed. This fixture kept the previous document. You can edit or retry.\n${result.error.message}`;
    if (result.status === 'loaded') square = undefined;
  } finally {
    controller = undefined;
    controls.forEach((id) => { $(id).disabled = false; });
    $('cancel').disabled = true;
  }
}

for (const kind of ['valid', 'missing', 'unknown', 'pending']) $(kind).onclick = () => load(kind);
$('cancel').onclick = () => { controller?.abort(); };
$('automatic').onchange = () => { canvas.renderOnAddRemove = $('automatic').checked; };
$('add').onclick = () => {
  if (square) return;
  square = new Rect({ originX: 'left', originY: 'top', left: 160, top: 140, width: 50, height: 50, fill: '#275fd1' });
  canvas.add(square);
};
$('remove').onclick = () => {
  if (square) canvas.remove(square);
  square = undefined;
};
$('render').onclick = () => canvas.requestRenderAll();
