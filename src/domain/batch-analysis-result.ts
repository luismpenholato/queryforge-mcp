import type { QuerySmell } from './query-smell.js';
import type { Severity } from './severity.js';

export interface FileAnalysisResult {
  path: string;
  severity: Severity;
  score: number;
  smellCount: number;
  highImpactSmells: string[];
  smells: QuerySmell[];
  recommendations: string[];
  manualReviewRequired: boolean;
  truncated?: boolean;
}

export interface BatchAnalysisResult {
  filesAnalyzed: number;
  filesWithIssues: number;
  highestSeverity: Severity;
  results: FileAnalysisResult[];
  topRisks: FileAnalysisResult[];
  summary: string;
}
