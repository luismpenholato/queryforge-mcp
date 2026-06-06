import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IndexCandidateService } from '../../src/application/index-candidate.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexCandidateQuery = readFileSync(
  join(__dirname, '../../examples/index-candidate-query.cs'),
  'utf-8'
);

describe('index-candidate-query.cs example', () => {
  const service = new IndexCandidateService();

  it('should generate index candidate with expected columns and SQL', () => {
    const result = service.suggest({
      code: indexCandidateQuery,
      databaseProvider: 'sql-server',
      tableName: 'Orders'
    });

    expect(result.candidates.length).toBeGreaterThan(0);

    const columnNames = result.candidates[0].columns.map((column) => column.name);

    expect(columnNames).toContain('CustomerId');
    expect(columnNames).toContain('Status');
    expect(columnNames).toContain('OrderedAt');
    expect(columnNames).toContain('Id');
    expect(result.candidates[0].sql).toContain('CREATE INDEX');
    expect(result.candidates[0].sql).toContain('IX_Orders_');
    expect(result.manualReviewRequired).toBe(true);
  });
});
