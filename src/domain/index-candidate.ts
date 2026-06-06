export interface IndexColumn {
  name: string;
  kind: 'equality' | 'range' | 'ordering';
  direction?: 'ASC' | 'DESC';
}

export interface IndexCandidate {
  tableName: string;
  columns: IndexColumn[];
  includedColumns?: string[];
  sql?: string;
  confidence: number;
  reasons: string[];
  warnings: string[];
  manualReviewRequired: boolean;
  requiresQueryRewrite?: boolean;
  rewriteRequiredReason?: string;
}
