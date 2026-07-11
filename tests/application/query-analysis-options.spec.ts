import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';
import { QueryBatchAnalysisService } from '../../src/application/query-batch-analysis.service.js';

describe('analysis options', () => {
  const service = new QueryAnalysisService();
  const batchService = new QueryBatchAnalysisService();

  it('should respect maxIssues and set truncated', () => {
    const result = service.analyze(
      {
        provider: 'ef-core',
        code: `
          var products = await _context.Products
            .Include(x => x.Category)
            .Skip(0)
            .Take(10)
            .ToListAsync();

          return products
            .Select(x => new ProductSummaryDto { Id = x.Id })
            .ToList();
        `
      },
      { maxIssues: 1 }
    );

    expect(result.smells).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it('should preserve previous behavior when maxIssues is omitted', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: `
        var products = await _context.Products
          .Include(x => x.Category)
          .Skip(0)
          .Take(10)
          .ToListAsync();

        return products
          .Select(x => new ProductSummaryDto { Id = x.Id })
          .ToList();
      `
    });

    expect(result.smells.length).toBeGreaterThan(1);
    expect(result.truncated).toBeUndefined();
  });

  it('should abort individual analysis when signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();

    expect(() =>
      service.analyze(
        {
          provider: 'ef-core',
          code: 'return await _context.Products.CountAsync() > 0;'
        },
        { signal: controller.signal }
      )
    ).toThrow();
  });

  it('should abort batch analysis between files', () => {
    const controller = new AbortController();
    controller.abort();

    expect(() =>
      batchService.analyze(
        {
          provider: 'ef-core',
          files: [
            { path: 'A.cs', content: 'return await _context.Products.CountAsync() > 0;' },
            { path: 'B.cs', content: 'return await _context.Orders.CountAsync() > 0;' }
          ]
        },
        { signal: controller.signal }
      )
    ).toThrow();
  });

  it('should attach fingerprints and ranges to smells', () => {
    const result = service.analyze({
      provider: 'ef-core',
      filePath: 'Features/ProductService.cs',
      code: 'var exists = await query.CountAsync() > 0;'
    });

    const issue = result.smells.find((smell) => smell.code === 'COUNT_GREATER_THAN_ZERO');

    expect(issue?.range).toBeDefined();
    expect(issue?.fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(issue?.fixes?.some((fix) => fix.safety === 'safe')).toBe(true);
  });
});
