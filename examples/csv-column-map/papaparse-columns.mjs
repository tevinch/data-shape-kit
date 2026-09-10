import Papa from 'papaparse';

import { createColumnProjector } from './column-map.mjs';

function parseError(errors) {
  const descriptions = errors.map(({ code, message }) => `${code}: ${message}`);
  return Object.assign(new Error(`CSV parse error: ${descriptions.join('; ')}`), {
    code: errors[0].code,
  });
}

export function selectCsvColumns(csv, mapping, options = {}) {
  if (typeof csv !== 'string') {
    throw new TypeError('csv must be a string');
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const delimiter = options.delimiter === undefined ? ',' : options.delimiter;
  if (
    typeof delimiter !== 'string'
    || delimiter.length === 0
    || Papa.BAD_DELIMITERS.some((badDelimiter) => delimiter.includes(badDelimiter))
  ) {
    throw new TypeError('delimiter must be a nonempty string without PapaParse forbidden characters');
  }

  const { data, errors } = Papa.parse(csv, {
    delimiter,
    header: false,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  if (errors.length > 0) throw parseError(errors);
  if (data.length === 0) {
    throw new Error('CSV must contain at least one header record');
  }

  const [headers, ...rows] = data;
  const project = createColumnProjector(headers, mapping);
  return rows.map((row, index) => {
    try {
      return project(row);
    } catch (error) {
      const ErrorType = error instanceof TypeError ? TypeError : Error;
      throw new ErrorType(`Data row ${index + 1}: ${error.message}`, { cause: error });
    }
  });
}
