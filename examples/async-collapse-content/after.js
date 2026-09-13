import { h } from 'vue';
import { NDataTable } from 'naive-ui';

export function createTableSlot(vm) {
  return () => h(NDataTable, { columns: vm.columns, data: vm.rows, rowKey: row => row.label });
}
