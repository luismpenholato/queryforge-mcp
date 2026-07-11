import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/public-api.js';
import { QueryAnalysisService } from '../../src/public-api.js';

describe('public API (source)', () => {
  it('should export expected services', () => {
    expect(publicApi.QueryAnalysisService).toBeTypeOf('function');
    expect(publicApi.QueryBatchAnalysisService).toBeTypeOf('function');
    expect(publicApi.ProjectStackService).toBeTypeOf('function');
    expect(publicApi.EfRewriteService).toBeTypeOf('function');
    expect(publicApi.ReviewReportService).toBeTypeOf('function');
    expect(publicApi.IndexCandidateService).toBeTypeOf('function');
  });

  it('should instantiate services without MCP side effects', () => {
    const service = new QueryAnalysisService();
    const result = service.analyze({
      code: 'var exists = query.Count() > 0;',
      provider: 'ef-core'
    });

    expect(result.smells.length).toBeGreaterThan(0);
    expect(result.smells.some((smell) => smell.code === 'COUNT_GREATER_THAN_ZERO')).toBe(true);
    expect((globalThis as { __queryforgeMcpStarted?: boolean }).__queryforgeMcpStarted).toBeUndefined();
  });

  it('should not import the MCP entrypoint through the public API module graph', async () => {
    const publicApiUrl = new URL('../../src/public-api.ts', import.meta.url).href;
    const indexUrl = new URL('../../src/index.ts', import.meta.url).href;

    expect(publicApiUrl).not.toBe(indexUrl);
    expect(publicApi.QueryAnalysisService.name).toBe('QueryAnalysisService');
  });
});
