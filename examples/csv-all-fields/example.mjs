import { exportCsv } from './recipe.mjs';

const rows = [{ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }];
console.log(exportCsv(rows));
