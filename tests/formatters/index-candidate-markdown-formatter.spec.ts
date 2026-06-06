import { describe, expect, it } from 'vitest';
import { formatIndexCandidatesAsMarkdown } from '../../src/formatters/index-candidate-markdown-formatter.js';
import { IndexCandidateResult } from '../../src/domain/index-candidate-result.js';

describe('formatIndexCandidatesAsMarkdown', () => {
  it('should format candidate with SQL', () => {
    const result: IndexCandidateResult = {
      summary: 'Generated 1 conservative index candidate(s) for review.',
      databaseProvider: 'sql-server',
      tableName: 'Orders',
      analysisSmells: ['MISSING_AS_NO_TRACKING'],
      warnings: ['Validate with execution plan.'],
      manualReviewRequired: true,
      candidates: [
        {
          tableName: 'Orders',
          columns: [
            { name: 'CustomerId', kind: 'equality' },
            { name: 'OrderedAt', kind: 'range', direction: 'DESC' }
          ],
          sql: 'CREATE INDEX IX_Orders_CustomerId_OrderedAt\nON Orders (CustomerId, OrderedAt DESC);',
          confidence: 0.8,
          reasons: ['Query filters by equality column CustomerId.'],
          warnings: ['Validate with execution plan.'],
          manualReviewRequired: true
        }
      ]
    };

    const markdown = formatIndexCandidatesAsMarkdown(result);

    expect(markdown).toContain('# QueryForge Index Candidates');
    expect(markdown).toContain('Manual review required: yes');
    expect(markdown).toContain('IX_Orders_CustomerId_OrderedAt');
    expect(markdown).toContain('CREATE INDEX');
    expect(markdown).toContain('Validation checklist');
  });

  it('should format warnings and empty candidates', () => {
    const result: IndexCandidateResult = {
      summary: 'No index candidates could be generated from the current heuristics.',
      databaseProvider: 'postgresql',
      tableName: 'UnknownTable',
      analysisSmells: [],
      warnings: ['Database provider is unknown. Generated SQL is generic and requires manual adaptation.'],
      manualReviewRequired: true,
      candidates: []
    };

    const markdown = formatIndexCandidatesAsMarkdown(result);

    expect(markdown).toContain('## Warnings');
    expect(markdown).toContain('No index candidates could be generated');
    expect(markdown).toContain('Validation checklist');
  });
});
