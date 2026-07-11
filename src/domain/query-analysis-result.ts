import type { QuerySmell } from './query-smell.js';
import type { Severity } from './severity.js';

export interface QueryAnalysisResult {
  summary: string;
  severity: Severity;
  smells: QuerySmell[];
  recommendations: string[];
  manualReviewRequired: boolean;
  truncated?: boolean;
}
