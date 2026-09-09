import assert from 'node:assert/strict';
import test from 'node:test';

import {demoRows} from './demo-data.mjs';

test('provides the fixed 23-row synthetic catalog', () => {
  assert.equal(demoRows.length, 23);
  assert.deepEqual(demoRows[0], {
    id: 'item-001',
    title: 'Resource 01',
    category: 'Utilities',
    selectable: true,
  });
  assert.deepEqual(demoRows[6], {
    id: 'item-007',
    title: 'Resource 07',
    category: 'Utilities',
    selectable: false,
  });
  assert.deepEqual(demoRows[22], {
    id: 'item-023',
    title: 'Resource 23',
    category: 'Utilities',
    selectable: true,
  });

  assert.equal(demoRows.filter((row) => row.category === 'Guides').length, 11);
  assert.equal(demoRows.filter((row) => row.selectable).length, 20);
  assert.equal(new Set(demoRows.map((row) => row.id)).size, 23);
  assert.ok(Object.isFrozen(demoRows));
  assert.ok(demoRows.every(Object.isFrozen));
});
