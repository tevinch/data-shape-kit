import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const files=new Map([['/','index.html'],['/demo.js','dist/demo.js']]);
createServer(async(req,res)=>{
 const file=files.get(new URL(req.url,'http://localhost').pathname);
 if(!file)return res.writeHead(404).end('Not found');
 try{const data=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end(data);}
 catch{res.writeHead(500).end('Run npm ci and npm run build first.');}
}).listen(8774,'127.0.0.1',()=>console.log('Open http://127.0.0.1:8774'));
