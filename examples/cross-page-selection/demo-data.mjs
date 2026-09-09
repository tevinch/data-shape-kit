const categories = /** @type {const} */ (['Guides', 'Utilities']);

export const demoRows = Object.freeze(
  Array.from({length: 23}, (_, index) => {
    const number = index + 1;
    return Object.freeze({
      id: `item-${String(number).padStart(3, '0')}`,
      title: `Resource ${String(number).padStart(2, '0')}`,
      category: categories[number % 2],
      selectable: number % 7 !== 0,
    });
  }),
);
