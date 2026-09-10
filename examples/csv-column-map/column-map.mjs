export function createColumnProjector(headers, mapping) {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new TypeError('headers must be a nonempty dense array of strings');
  }
  for (let index = 0; index < headers.length; index += 1) {
    if (!Object.hasOwn(headers, index) || typeof headers[index] !== 'string') {
      throw new TypeError('headers must be a nonempty dense array of strings');
    }
  }

  const prototype = mapping === null || mapping === undefined
    ? undefined
    : Object.getPrototypeOf(mapping);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('mapping must be a plain object');
  }

  const entries = Object.entries(mapping);
  if (entries.length === 0) {
    throw new TypeError('mapping must contain at least one selection');
  }

  const destinationNames = new Set();
  const selections = entries.map(([sourceName, outputName]) => {
    if (typeof outputName !== 'string' || outputName.length === 0) {
      throw new TypeError(`Destination name for "${sourceName}" must be a nonempty string`);
    }
    if (destinationNames.has(outputName)) {
      throw new TypeError(`Destination name "${outputName}" must be unique`);
    }
    destinationNames.add(outputName);

    const matchingIndices = [];
    for (let index = 0; index < headers.length; index += 1) {
      if (headers[index] === sourceName) matchingIndices.push(index);
    }
    if (matchingIndices.length === 0) {
      throw new Error(`Selected header "${sourceName}" was not found`);
    }
    if (matchingIndices.length > 1) {
      throw new Error(`Selected header "${sourceName}" is ambiguous (${matchingIndices.length} matches)`);
    }

    return [outputName, matchingIndices[0]];
  });
  const width = headers.length;

  return (row) => {
    if (!Array.isArray(row)) {
      throw new TypeError('row must be an array');
    }
    if (row.length !== width) {
      throw new Error(`Row width must be ${width}; received ${row.length}`);
    }
    for (let index = 0; index < row.length; index += 1) {
      if (!Object.hasOwn(row, index)) {
        throw new TypeError('row must be a dense array');
      }
    }

    return Object.fromEntries(
      selections.map(([outputName, index]) => [outputName, row[index]]),
    );
  };
}
