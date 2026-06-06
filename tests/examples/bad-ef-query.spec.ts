import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const badEfQuery = readFileSync(join(__dirname, '../../examples/bad-ef-query.cs'), 'utf-8');

describe('bad-ef-query.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect the expected smells from the example file', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: badEfQuery
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('TO_LIST_BEFORE_SELECT');
    expect(codes).toContain('UNNECESSARY_INCLUDE_WITH_PROJECTION');
    expect(codes).toContain('MISSING_AS_NO_TRACKING');
    expect(result.severity).toBe('high');
    expect(result.manualReviewRequired).toBe(true);
  });
});
