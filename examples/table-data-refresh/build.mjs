import fs from 'node:fs/promises';
import { transformAsync } from '@babel/core';
import { build } from 'esbuild';
const events=[];
const source=await fs.readFile('main.tsx','utf8');
const transformed=await transformAsync(source,{filename:'main.tsx',
  plugins:[['babel-plugin-react-compiler',{target:'19',panicThreshold:'all_errors',logger:{logEvent(filename,event){events.push({filename:'main.tsx',...event});}}}]],
  presets:[['@babel/preset-react',{runtime:'automatic'}],['@babel/preset-typescript',{isTSX:true,allExtensions:true}]]});
await fs.mkdir('dist',{recursive:true});
await fs.writeFile('dist/compiled.js',transformed.code);
await fs.writeFile('dist/compiler-events.json',JSON.stringify(events,null,2));
await build({entryPoints:['dist/compiled.js'],bundle:true,format:'esm',outfile:'dist/app.js',define:{'process.env.NODE_ENV':'"development"'}});
await fs.writeFile('dist/index.html','<!doctype html><html><head><meta charset="utf-8"><title>Table data refresh</title><style>body{font:16px system-ui;margin:30px}button,input{margin:6px;padding:6px}td,th{padding:12px;border:1px solid #ddd}table{border-collapse:collapse}pre{white-space:pre-wrap;max-width:800px}</style></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
console.log(JSON.stringify(events.map(({kind,fnName,detail})=>({kind,fnName,detail}))));
