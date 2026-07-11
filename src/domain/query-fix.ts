import type { SourceRange } from './source-range.js';

export type QueryFixSafety = 'safe' | 'review-required';

export interface QueryTextEdit {
  range: SourceRange;
  newText: string;
}

export interface QueryFix {
  id: string;
  title: string;
  safety: QueryFixSafety;
  edits?: QueryTextEdit[];
}
