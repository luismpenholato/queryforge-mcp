import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleCode = readFileSync(
  join(__dirname, '../../examples/string-search-query.cs'),
  'utf-8'
);

describe('string-search-query.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect non-sargable string search smells', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: exampleCode
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('STRING_TRANSFORM_ON_COLUMN_FILTER');
    expect(codes).toContain('CONTAINS_ON_STRING_COLUMN');
    expect(codes).toContain('TO_STRING_IN_QUERY_FILTER');
    expect(codes).toContain('CONTAINS_ON_CONVERTED_VALUE');
    expect(result.severity).toBe('high');
    expect(result.manualReviewRequired).toBe(true);
  });
});
