import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleCode = readFileSync(
  join(__dirname, '../../examples/function-on-column-query.cs'),
  'utf-8'
);

describe('function-on-column-query.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect DateTime members inside complex multiline Where filters', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: exampleCode
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('FUNCTION_ON_COLUMN_FILTER');
    expect(codes).toContain('TO_STRING_IN_QUERY_FILTER');
    expect(codes).toContain('CONTAINS_ON_CONVERTED_VALUE');
    expect(codes).toContain('REDUNDANT_MONTH_RANGE_FILTER');
    expect(codes).toContain('LARGE_TAKE');
    expect(codes).toContain('LARGE_TAKE_WITH_ORDER_BY');
    expect(codes).toContain('MISSING_AS_NO_TRACKING');
    expect(result.severity).toBe('high');
    expect(result.manualReviewRequired).toBe(true);
  });
});
