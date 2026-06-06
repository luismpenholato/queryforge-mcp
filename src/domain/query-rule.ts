import { QueryAnalysisRequest } from './query-analysis-request.js';
import { QuerySmell } from './query-smell.js';

export interface QueryRule {
  code: string;
  analyze(request: QueryAnalysisRequest): QuerySmell[];
}
