import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleCode = readFileSync(
  join(__dirname, '../../examples/multiple-includes-query.cs'),
  'utf-8'
);

describe('multiple-includes-query.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect multiple includes and projection smells', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: exampleCode
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('MULTIPLE_COLLECTION_INCLUDES');
    expect(codes).toContain('UNNECESSARY_INCLUDE_WITH_PROJECTION');
    expect(codes).toContain('MISSING_AS_NO_TRACKING');
    expect(result.severity).toBe('medium');
  });
});
