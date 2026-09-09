export type Category = 'all' | 'Guides' | 'Utilities' | 'Empty';
export type SortDirection = 'asc' | 'desc';

export interface DemoRow {
  readonly id: string;
  readonly title: string;
  readonly category: 'Guides' | 'Utilities';
  readonly selectable: boolean;
}

export interface PageResponse {
  readonly rows: DemoRow[];
  readonly rowCount: number;
  readonly eligibleCount: number;
  readonly scope: string;
  readonly pageIndex: number;
  readonly pageSize: number;
}

export interface PreviewResponse {
  readonly scope: string;
  readonly count: number;
  readonly rows: DemoRow[];
}

export interface ErrorResponse {
  readonly error: string;
}
