import { describe, expect, it } from 'vitest';
import { IndexCandidateService } from '../../src/application/index-candidate.service.js';
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
          manualReviewRequired: true,
          requiresQueryRewrite: true,
          rewriteRequiredReason:
            'Function-on-column or non-sargable filters must be rewritten before this index can be useful.'
        }
      ]
    };

    const markdown = formatIndexCandidatesAsMarkdown(result);

    expect(markdown).toContain('# QueryForge Index Candidates');
    expect(markdown).toContain('Requires query rewrite before this index can be useful: yes');
    expect(markdown).toContain('Manual review required: yes');
    expect(markdown).toContain('## Current query candidate');
    expect(markdown).toContain('IX_Orders_CustomerId_OrderedAt');
    expect(markdown).toContain('CREATE INDEX');
    expect(markdown).toContain('Validation checklist');
  });

  it('should format post-rewrite evaluation section', () => {
    const result: IndexCandidateResult = {
      summary:
        'After rewriting non-sargable filters, the first candidate targets OrderedAt. Additional composite keys (TotalAmount) require per-column filter rewrites.',
      databaseProvider: 'sql-server',
      tableName: 'Orders',
      analysisSmells: ['FUNCTION_ON_COLUMN_FILTER', 'TO_STRING_IN_QUERY_FILTER'],
      warnings: ['Creating an index before the query rewrite tends to be maintenance cost without gain.'],
      manualReviewRequired: true,
      notRecommendedNotes: [
        'Normal B-tree indexes do not solve the current non-sargable filter on TotalAmount (for example ToString/Contains or string transformation).',
        'Function-on-column filters (Year, Month, DATEPART, etc.) are not solved by indexing the derived member. Rewrite to a range on the base column first.'
      ],
      postRewriteEvaluation: [
        'After rewriting the OrderedAt filter to a sargable range predicate, the first candidate is:',
        'CREATE INDEX IX_Orders_OrderedAt\nON Orders (OrderedAt DESC);',
        'If the TotalAmount filter is also rewritten to a sargable typed numeric or range comparison, a composite candidate may be evaluated:',
        'CREATE INDEX IX_Orders_OrderedAt_TotalAmount\nON Orders (OrderedAt DESC, TotalAmount);',
        'TotalAmount should not be added to the index before that filter rewrite.'
      ],
      candidates: [
        {
          tableName: 'Orders',
          columns: [{ name: 'OrderedAt', kind: 'ordering', direction: 'DESC' }],
          sql: 'CREATE INDEX IX_Orders_OrderedAt\nON Orders (OrderedAt DESC);',
          confidence: 0.15,
          reasons: [
            'TotalAmount should not be added to the index until its filter is rewritten to a sargable typed numeric or range comparison.'
          ],
          warnings: [],
          manualReviewRequired: true,
          requiresQueryRewrite: true,
          rewriteRequiredReason:
            'Function-on-column or non-sargable filters must be rewritten before this index can be useful.'
        }
      ]
    };

    const markdown = formatIndexCandidatesAsMarkdown(result);

    expect(markdown).toContain('## Current query candidate');
    expect(markdown).toContain('Conditional candidate for the current query shape');
    expect(markdown).toContain('## Post-rewrite candidate');
    expect(markdown).toContain('first candidate is:');
    expect(markdown).toContain('IX_Orders_OrderedAt_TotalAmount');
    expect(markdown).toContain('TotalAmount should not be added to the index before that filter rewrite');
    expect(markdown).toContain('## Not recommended / not solved by normal B-tree index');
    expect(markdown).toContain('Normal B-tree indexes do not solve the current non-sargable filter on TotalAmount');
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
    expect(markdown).toContain('No safe direct index candidate was generated');
    expect(markdown).toContain('Validation checklist');
  });

  it('should never contain ContinueWith in formatted index candidate output', () => {
    const service = new IndexCandidateService();
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o =>
            o.OrderedAt.Year == currentYear &&
            o.TotalAmount.ToString().Contains("3"))
          .OrderByDescending(o => o.OrderedAt)
          .Take(30_000)
          .ToListAsync(ct);
      `,
      databaseProvider: 'sql-server',
      tableName: 'Orders'
    });
    const markdown = formatIndexCandidatesAsMarkdown(result);

    expect(markdown).not.toContain('ContinueWith');
    expect(markdown).toContain('## Current query candidate');
  });
});
