import { QueryProvider } from './query-provider.js';

export interface QueryAnalysisRequest {
  code: string;
  provider?: QueryProvider;
  context?: string;
}
