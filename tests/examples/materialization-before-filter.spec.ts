import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleCode = readFileSync(
  join(__dirname, '../../examples/materialization-before-filter.cs'),
  'utf-8'
);

describe('materialization-before-filter.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect materialization smells before query operators', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: exampleCode
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('TO_LIST_BEFORE_WHERE');
    expect(codes).toContain('TO_LIST_BEFORE_ORDER_BY');
    expect(codes).toContain('TO_LIST_BEFORE_SKIP_TAKE');
    expect(codes).toContain('TO_LIST_BEFORE_SELECT');
    expect(result.severity).toBe('high');
    expect(result.manualReviewRequired).toBe(true);
  });
});
