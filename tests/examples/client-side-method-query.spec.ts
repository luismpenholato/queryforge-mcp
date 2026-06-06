import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleCode = readFileSync(
  join(__dirname, '../../examples/client-side-method-query.cs'),
  'utf-8'
);

describe('client-side-method-query.cs example', () => {
  const service = new QueryAnalysisService();

  it('should detect custom methods inside Where', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: exampleCode
    });

    const codes = result.smells.map((s) => s.code);

    expect(codes).toContain('CLIENT_SIDE_METHOD_IN_WHERE');
    expect(result.severity).toBe('medium');
  });
});
