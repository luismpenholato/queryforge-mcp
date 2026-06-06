import { describe, expect, it } from 'vitest';
import { formatBatchAnalysisAsMarkdown } from '../../src/formatters/batch-analysis-markdown-formatter.js';
import { BatchAnalysisResult } from '../../src/domain/batch-analysis-result.js';

describe('formatBatchAnalysisAsMarkdown', () => {
  it('should format batch analysis with top risky files', () => {
    const result: BatchAnalysisResult = {
      filesAnalyzed: 2,
      filesWithIssues: 1,
      highestSeverity: 'high',
      summary: 'Analyzed 2 file(s). Found issues in 1 file(s). Highest severity: high.',
      results: [],
      topRisks: [
        {
          path: 'Features/Orders/BadHandler.cs',
          severity: 'high',
          score: 25,
          smellCount: 3,
          highImpactSmells: ['FUNCTION_ON_COLUMN_FILTER', 'TO_STRING_IN_QUERY_FILTER'],
          manualReviewRequired: true,
          recommendations: ['Use range filters instead of DateTime members in query filters.'],
          smells: [
            {
              code: 'FUNCTION_ON_COLUMN_FILTER',
              title: 'Function on column inside filter',
              severity: 'high',
              message: 'Date/time member used inside query filter.',
              suggestion: 'Use range filters.',
              confidence: 0.88,
              category: 'sargability'
            }
          ]
        }
      ]
    };

    const markdown = formatBatchAnalysisAsMarkdown(result);

    expect(markdown).toContain('# QueryForge Batch Analysis');
    expect(markdown).toContain('Files analyzed: 2');
    expect(markdown).toContain('Features/Orders/BadHandler.cs');
    expect(markdown).toContain('FUNCTION_ON_COLUMN_FILTER');
    expect(markdown).toContain('Review order');
  });

  it('should format empty top risks', () => {
    const result: BatchAnalysisResult = {
      filesAnalyzed: 1,
      filesWithIssues: 0,
      highestSeverity: 'info',
      summary:
        'Analyzed 1 file(s). No query performance smells were detected by the current rules.',
      results: [],
      topRisks: []
    };

    const markdown = formatBatchAnalysisAsMarkdown(result);

    expect(markdown).toContain('No risky files were found by the current rules.');
  });
});
