import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TextDecoder } from 'node:util';

import { parse } from 'csv-parse';

const DEFAULT_MAX_RECORD_SIZE = 1_048_576;
const SUPPORTED_OPTIONS = new Set(['delimiter', 'maxRecordSize', 'signal']);

function validateArguments(source, onRow, options) {
  if (!(source instanceof Readable)) {
    throw new TypeError('source must be a Node Readable stream');
  }
  if (source.readableObjectMode) {
    throw new TypeError('source must be a byte stream, not an object-mode stream');
  }
  if (source.readableEncoding !== null) {
    throw new TypeError('source must not have a text encoding');
  }
  if (source.destroyed || source.readableEnded || source.readableDidRead) {
    throw new TypeError('source must be a fresh readable stream');
  }
  if (typeof onRow !== 'function') {
    throw new TypeError('onRow must be a function');
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  for (const option of Object.keys(options)) {
    if (!SUPPORTED_OPTIONS.has(option)) {
      throw new TypeError(`Unsupported option: ${option}`);
    }
  }

  const delimiter = options.delimiter ?? ',';
  if (typeof delimiter !== 'string' || delimiter.length === 0 || /[\r\n"]/.test(delimiter)) {
    throw new TypeError('delimiter must be a nonempty string without CR, LF, or double quotes');
  }

  const maxRecordSize = options.maxRecordSize ?? DEFAULT_MAX_RECORD_SIZE;
  if (!Number.isSafeInteger(maxRecordSize) || maxRecordSize <= 0) {
    throw new TypeError('maxRecordSize must be a positive safe integer');
  }

  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new TypeError('signal must be a native AbortSignal');
  }

  return { delimiter, maxRecordSize, signal: options.signal };
}

function createUtf8Decoder() {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        callback(null, decoder.decode(chunk, { stream: true }));
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        callback(null, decoder.decode());
      } catch (error) {
        callback(error);
      }
    },
  });
}

function csvError(message, code) {
  return Object.assign(new Error(message), { code });
}

export async function consumeCsv(source, onRow, options = {}) {
  const { delimiter, maxRecordSize, signal } = validateArguments(source, onRow, options);
  let headers;
  let rows = 0;

  await pipeline(
    source,
    createUtf8Decoder(),
    parse({
      bom: true,
      columns: false,
      cast: false,
      skip_empty_lines: true,
      delimiter,
      max_record_size: maxRecordSize,
    }),
    async (records, { signal: pipelineSignal }) => {
      for await (const cells of records) {
        pipelineSignal.throwIfAborted();

        if (!headers) {
          const seen = new Set();
          for (const name of cells) {
            if (!name.trim()) {
              throw csvError('Empty header', 'CSV_EMPTY_HEADER');
            }
            if (seen.has(name)) {
              throw csvError('Duplicate header', 'CSV_DUPLICATE_HEADER');
            }
            seen.add(name);
          }
          headers = [...cells];
          continue;
        }

        const record = Object.fromEntries(headers.map((name, index) => [name, cells[index]]));
        await onRow(record, { rowNumber: rows + 1, signal: pipelineSignal });
        pipelineSignal.throwIfAborted();
        rows += 1;
      }
    },
    { signal },
  );

  if (!headers) {
    throw csvError('Missing header', 'CSV_MISSING_HEADER');
  }

  return { rows, headers: [...headers] };
}
