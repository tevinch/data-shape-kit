const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
function serverFor(mode) {
  const base = path.join(__dirname, 'dist', mode);
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    try {
      if (!file.startsWith(base + path.sep)) throw new Error('Missing');
      res.setHeader('content-type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(await fs.readFile(file));
    } catch { res.statusCode = 404; res.end('Missing'); }
  });
}
module.exports = { serverFor };
if (require.main === module) serverFor('fixed').listen(4173, '127.0.0.1', () => console.log('Month calendar: http://127.0.0.1:4173'));
