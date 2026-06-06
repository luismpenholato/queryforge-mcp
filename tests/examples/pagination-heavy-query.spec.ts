import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleCode = readFileSync(
  join(__dirname, '../../examples/pagination-heavy-query.cs'),
  'utf-8'
);

describe('pagination-heavy-query.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect pagination and ordering volume smells', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: exampleCode
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('MULTIPLE_ORDER_BY');
    expect(codes).toContain('LARGE_TAKE');
    expect(codes).toContain('LARGE_TAKE_WITH_ORDER_BY');
    expect(result.severity).toBe('medium');
  });
});
