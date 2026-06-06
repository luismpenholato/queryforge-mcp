import { QueryProvider } from './query-provider.js';
import { QueryFileInput } from './query-file-input.js';

export interface BatchAnalysisRequest {
  files: QueryFileInput[];
  provider?: QueryProvider;
  context?: string;
}
