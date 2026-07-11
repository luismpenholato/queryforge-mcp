import type { ProjectAnalysisContext } from './project-analysis-context.js';
import type { QueryProvider } from './query-provider.js';

export interface QueryAnalysisRequest {
  code: string;
  provider?: QueryProvider;
  /** @deprecated Use `project` for structured context. Plain string kept for MCP compatibility. */
  context?: string;
  filePath?: string;
  languageId?: string;
  project?: ProjectAnalysisContext;
}

export function resolveReadOnlyContext(request: QueryAnalysisRequest): boolean {
  if (request.context?.toLowerCase().includes('read-only')) {
    return true;
  }

  return false;
}
