import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/public-api.js';
import { QueryAnalysisService } from '../../src/public-api.js';

describe('public API', () => {
  it('should export expected services and types', () => {
    expect(publicApi.QueryAnalysisService).toBeTypeOf('function');
    expect(publicApi.QueryBatchAnalysisService).toBeTypeOf('function');
    expect(publicApi.ProjectStackService).toBeTypeOf('function');
    expect(publicApi.EfRewriteService).toBeTypeOf('function');
    expect(publicApi.ReviewReportService).toBeTypeOf('function');
    expect(publicApi.IndexCandidateService).toBeTypeOf('function');
  });

  it('should instantiate services without side effects', () => {
    const service = new QueryAnalysisService();
    const result = service.analyze({
      code: 'var exists = query.Count() > 0;',
      provider: 'ef-core'
    });

    expect(result.smells.length).toBeGreaterThan(0);
    expect((globalThis as { __queryforgeMcpStarted?: boolean }).__queryforgeMcpStarted).toBeUndefined();
  });

  it('should expose generated declarations after build', () => {
    const declarationPath = resolve(process.cwd(), 'dist/public-api.d.ts');
    expect(existsSync(declarationPath)).toBe(true);

    const contents = readFileSync(declarationPath, 'utf8');
    expect(contents).toContain('QueryAnalysisService');
    expect(contents).toContain('export type { QueryAnalysisRequest }');
  });
});
