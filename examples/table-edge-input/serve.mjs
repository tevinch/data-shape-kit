import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const routes = new Map(['index.html', 'demo.js', 'checks.js', 'table-edge-input.js'].map(file => [`/${file}`, file]));
routes.set('/', 'index.html');
for (const file of ['tinymce.min.js', 'themes/silver/theme.min.js', 'models/dom/model.min.js', 'icons/default/icons.min.js', 'plugins/table/plugin.min.js', 'skins/ui/oxide/skin.min.css', 'skins/ui/oxide/content.min.css', 'skins/content/default/content.min.css']) {
  routes.set(`/vendor/${file}`, `node_modules/tinymce/${file}`);
}
createServer(async (req, res) => {
  const file = routes.get(new URL(req.url, 'http://localhost').pathname);
  if (!file) return res.writeHead(404).end('Not found');
  try {
    const data = await readFile(new URL(file, import.meta.url));
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'text/javascript';
    res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store'}).end(data);
  } catch {
    res.writeHead(500).end('Run npm ci --ignore-scripts first.');
  }
}).listen(8773, '127.0.0.1', () => console.log('Open http://127.0.0.1:8773'));
