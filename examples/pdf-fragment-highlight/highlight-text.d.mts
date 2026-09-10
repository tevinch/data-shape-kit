export type TextItemLike = { str: string; hasEOL?: boolean };
export type MarkedContentLike = { type: string; id?: string };
export type ItemSegment = { itemIndex: number; start: number; end: number };
export type TextMatch = {
  queryIndex: number;
  start: number;
  end: number;
  segments: ItemSegment[];
};
export type HighlightResult = { text: string; matches: TextMatch[]; html: string[] };

export function highlightTextItems(
  items: readonly (TextItemLike | MarkedContentLike)[],
  queries: readonly string[],
  options?: { caseSensitive?: boolean },
): HighlightResult;
