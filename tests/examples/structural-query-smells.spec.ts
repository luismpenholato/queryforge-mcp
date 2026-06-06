import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const structuralQuerySmells = readFileSync(
  join(__dirname, '../../examples/structural-query-smells.cs'),
  'utf-8'
);

describe('structural-query-smells.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect all structural query smells from the example file', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: structuralQuerySmells
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('N_PLUS_ONE_QUERY_IN_LOOP');
    expect(codes).toContain('MULTIPLE_ROUND_TRIPS_IN_LOOP');
    expect(codes).toContain('CARTESIAN_PRODUCT_QUERY');
    expect(codes).toContain('CORRELATED_SUBQUERY_IN_PROJECTION');
    expect(codes).toContain('IMPLICIT_CONVERSION_IN_FILTER');
    expect(codes).toContain('DUPLICATED_PREDICATE');
    expect(codes).toContain('FULL_ENTITY_MATERIALIZATION');
    expect(result.severity).toBe('high');
    expect(result.manualReviewRequired).toBe(true);
  });
});
