import {open, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {demoRows} from './demo-data.mjs';
import {isSelected, readSelection} from './selection.mjs';

const PAGE_SIZE = 5;
const BODY_LIMIT = 64 * 1024;
const CATEGORIES = new Set(['all', 'Guides', 'Utilities', 'Empty']);
const SORTS = new Set(['asc', 'desc']);
const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function rowsForCategory(category) {
  if (category === 'Empty') return [];
  if (category === 'all') return demoRows;
  return demoRows.filter((row) => row.category === category);
}

function scopeForCategory(category) {
  return `catalog-v1:${category}`;
}

function categoryForScope(scope) {
  for (const category of CATEGORIES) {
    if (scope === scopeForCategory(category)) return category;
  }
  return undefined;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function badRequest(response, message) {
  sendJson(response, 400, {error: message});
}

function readPageQuery(url) {
  const category = url.searchParams.get('category') ?? 'all';
  const sort = url.searchParams.get('sort') ?? 'asc';
  const rawPageIndex = url.searchParams.get('pageIndex') ?? '0';

  if (!CATEGORIES.has(category)) throw new TypeError('category must be all, Guides, Utilities, or Empty');
  if (!SORTS.has(sort)) throw new TypeError('sort must be asc or desc');
  if (!/^(0|[1-9]\d*)$/.test(rawPageIndex)) {
    throw new TypeError('pageIndex must be a non-negative safe integer');
  }
  const pageIndex = Number(rawPageIndex);
  if (!Number.isSafeInteger(pageIndex)) {
    throw new TypeError('pageIndex must be a non-negative safe integer');
  }

  return {category, sort, pageIndex};
}

function handlePage(response, url) {
  let query;
  try {
    query = readPageQuery(url);
  } catch (error) {
    badRequest(response, error.message);
    return;
  }

  const matching = [...rowsForCategory(query.category)];
  if (query.sort === 'desc') matching.reverse();
  const start = query.pageIndex * PAGE_SIZE;
  sendJson(response, 200, {
    rows: matching.slice(start, start + PAGE_SIZE),
    rowCount: matching.length,
    eligibleCount: matching.filter((row) => row.selectable).length,
    scope: scopeForCategory(query.category),
    pageIndex: query.pageIndex,
    pageSize: PAGE_SIZE,
  });
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        const error = new RangeError('request body must not exceed 64 KiB');
        error.code = 'BODY_TOO_LARGE';
        rejectBody(error);
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', rejectBody);
  });
}

async function handlePreview(request, response) {
  let selection;
  try {
    const body = await readBody(request);
    selection = readSelection(JSON.parse(body));
    const category = categoryForScope(selection.scope);
    if (category === undefined) throw new TypeError('selection scope is not recognized');

    const eligibleRows = rowsForCategory(category).filter((row) => row.selectable);
    const eligibleIds = new Set(eligibleRows.map((row) => row.id));
    for (const id of selection.ids) {
      if (!eligibleIds.has(id)) {
        throw new TypeError(`selection ID is not eligible for scope: ${id}`);
      }
    }

    const selectedRows = eligibleRows.filter((row) => isSelected(selection, row.id));
    sendJson(response, 200, {
      scope: selection.scope,
      count: selectedRows.length,
      rows: selectedRows.slice(0, PAGE_SIZE),
    });
  } catch (error) {
    if (error?.code === 'BODY_TOO_LARGE') {
      sendJson(response, 413, {error: error.message});
      return;
    }
    badRequest(response, error instanceof SyntaxError ? 'request body must be valid JSON' : error.message);
  }
}

async function handleStatic(response, url, distDirectory) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    sendJson(response, 404, {error: 'not found'});
    return;
  }
  const requested = decodedPath === '/' ? 'index.html' : decodedPath.slice(1);
  const filePath = resolve(distDirectory, requested);
  const distPrefix = `${resolve(distDirectory)}${sep}`;
  if (!filePath.startsWith(distPrefix)) {
    sendJson(response, 404, {error: 'not found'});
    return;
  }

  try {
    const details = await stat(filePath);
    if (!details.isFile()) throw new Error('not a file');
    const file = await open(filePath, 'r');
    response.writeHead(200, {
      'content-type': CONTENT_TYPES.get(extname(filePath)) ?? 'application/octet-stream',
      'content-length': details.size,
    });
    await pipeline(file.createReadStream(), response);
  } catch {
    if (response.headersSent) {
      response.destroy();
    } else {
      sendJson(response, 404, {error: 'not found'});
    }
  }
}

export function createDemoServer(options = {}) {
  const distDirectory = options.distDirectory
    ?? fileURLToPath(new URL('./dist/', import.meta.url));

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/page') {
      handlePage(response, url);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/preview') {
      await handlePreview(request, response);
      return;
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      await handleStatic(response, url, distDirectory);
      return;
    }
    sendJson(response, 404, {error: 'not found'});
  });
}

function readPort(value) {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new TypeError('PORT must be an integer from 1 to 65535');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('PORT must be an integer from 1 to 65535');
  }
  return port;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let port;
  try {
    port = readPort(process.env.PORT ?? '8780');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }

  if (port !== undefined) {
    createDemoServer().listen(port, '127.0.0.1', () => {
      console.log(`Cross-page selection demo listening at http://127.0.0.1:${port}`);
    });
  }
}
