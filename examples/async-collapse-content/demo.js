import { createApp, defineComponent, h, ref, shallowRef } from 'vue';
import { NCollapseTransition } from 'naive-ui';
import { createTableSlot as before } from './before.js';
import { createTableSlot as after } from './after.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'before' ? 'before' : 'after';
const directive = params.get('directive') === 'show' ? 'show' : 'if';
const rows = shallowRef([]);
const shown = ref(params.get('hidden') !== '1');
const phase = ref('empty');
const columns = [{ key: 'label', title: 'Item' }];
const createTableSlot = mode === 'before' ? before : after;

const DraftNote = defineComponent({
  setup() {
    const note = ref('Draft note');
    return () => h('label', [
      'Unsaved note',
      h('input', { id: 'draft-note', value: note.value, onInput: event => { note.value = event.target.value; } }),
    ]);
  },
});

const Content = defineComponent({
  setup() { return { rows, shown, columns }; },
  render() {
    const tableSlot = createTableSlot(this);
    return h(NCollapseTransition, { show: this.shown, displayDirective: directive }, {
      default: () => [h(DraftNote), tableSlot()],
    });
  },
});

let requestId = 0;
async function load(replace = false) {
  const id = ++requestId;
  phase.value = 'loading';
  await new Promise(resolve => setTimeout(resolve, 100));
  if (id !== requestId) return;
  rows.value = replace
    ? [{ label: 'Replacement A' }, { label: 'Replacement B' }]
    : Array.from({ length: 8 }, (_, index) => ({ label: `Loaded row ${index + 1}` }));
  phase.value = replace ? 'replaced' : 'loaded';
}
function clear() {
  requestId++;
  rows.value = [];
  phase.value = 'empty';
}

createApp({
  setup() {
    return () => h('main', [
      h('h1', 'Async collapse content'),
      h('p', 'Load a table, edit the note, then replace the rows. The note stays while the data updates.'),
      h('p', `Example: ${mode === 'after' ? 'read data inside the slot' : 'create the table before the slot'}. Display directive: ${directive}.`),
      h('button', { id: 'load', onClick: () => load() }, 'Load eight rows'),
      h('button', { id: 'replace', onClick: () => load(true) }, 'Replace rows'),
      h('button', { id: 'clear', onClick: clear }, 'Clear rows'),
      h('button', { id: 'toggle', onClick: () => { shown.value = !shown.value; } }, shown.value ? 'Collapse' : 'Expand'),
      h('p', { id: 'source-state', 'aria-live': 'polite' }, `${phase.value}: ${rows.value.length} source rows`),
      h('div', { id: 'content' }, [h(Content)]),
      h('p', 'The show directive retains the note while collapsed. The if directive removes the content and resets its local note when reopened.'),
    ]);
  },
}).mount('#app');
