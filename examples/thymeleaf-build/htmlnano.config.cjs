module.exports = {
  collapseWhitespace: 'conservative',
  // Keep Thymeleaf processing comments and other meaningful comment markers.
  removeComments: comment => !/^<!--\s*(?:\/\*|\*\/|\[if\b|<!\[endif\b|!|#|\/?noindex\b|\/?sse\b|more\b)/i.test(comment),
  normalizeAttributeValues: false,
  removeEmptyAttributes: false,
  collapseAttributeWhitespace: false,
  collapseBooleanAttributes: false,
  deduplicateAttributeValues: false,
  sortAttributesWithLists: false,
  removeRedundantAttributes: false,
  removeOptionalTags: false,
  removeAttributeQuotes: false,
  minifyJson: false,
  minifyJs: false,
  minifyCss: false,
  minifySvg: false,
};
