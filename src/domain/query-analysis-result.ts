import { QuerySmell } from './query-smell.js';
import { Severity } from './severity.js';

export interface QueryAnalysisResult {
  summary: string;
  severity: Severity;
  smells: QuerySmell[];
  recommendations: string[];
  manualReviewRequired: boolean;
}
