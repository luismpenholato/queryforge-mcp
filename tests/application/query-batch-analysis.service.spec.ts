import { describe, expect, it } from 'vitest';
import { QueryBatchAnalysisService } from '../../src/application/query-batch-analysis.service.js';

describe('QueryBatchAnalysisService', () => {
  const service = new QueryBatchAnalysisService();

  it('should analyze multiple files and rank by risk score', () => {
    const result = service.analyze({
      provider: 'ef-core',
      files: [
        {
          path: 'Features/Orders/FunctionOnColumnHandler.cs',
          content: `
            return await _context.Orders
              .Where(o =>
                o.OrderedAt.Year == currentYear &&
                o.TotalAmount.ToString()!.Contains("3"))
              .OrderByDescending(o => o.OrderedAt)
              .Take(30_000)
              .Select(o => new OrderSummaryDto
              {
                Id = o.Id,
                TotalAmount = o.TotalAmount
              })
              .ToListAsync();
          `
        },
        {
          path: 'Features/Products/GetProductsHandler.cs',
          content: `
            return await _context.Products
              .Where(p => p.IsActive)
              .Select(p => new ProductSummaryDto
              {
                Id = p.Id,
                Name = p.Name
              })
              .ToListAsync();
          `
        }
      ]
    });

    expect(result.filesAnalyzed).toBe(2);
    expect(result.filesWithIssues).toBe(2);
    expect(result.highestSeverity).toBe('high');
    expect(result.topRisks[0].path).toBe('Features/Orders/FunctionOnColumnHandler.cs');
    expect(result.topRisks[0].highImpactSmells).toContain('FUNCTION_ON_COLUMN_FILTER');
    expect(result.topRisks[0].highImpactSmells).toContain('TO_STRING_IN_QUERY_FILTER');
  });

  it('should rank function-on-column above missing AsNoTracking only', () => {
    const result = service.analyze({
      provider: 'ef-core',
      files: [
        {
          path: 'Features/Products/MissingTrackingHandler.cs',
          content: `
            return await _context.Products
              .Where(p => p.IsActive)
              .Select(p => new ProductSummaryDto
              {
                Id = p.Id,
                Name = p.Name
              })
              .ToListAsync();
          `
        },
        {
          path: 'Features/Orders/BadDateFilterHandler.cs',
          content: `
            return await _context.Orders
              .Where(o => o.OrderedAt.Year == currentYear)
              .Select(o => new OrderSummaryDto
              {
                Id = o.Id
              })
              .ToListAsync();
          `
        }
      ]
    });

    expect(result.topRisks[0].path).toBe('Features/Orders/BadDateFilterHandler.cs');
    expect(result.topRisks[0].score).toBeGreaterThan(result.topRisks[1].score);
  });

  it('should handle clean files with low or zero risk', () => {
    const result = service.analyze({
      provider: 'ef-core',
      files: [
        {
          path: 'Features/Products/CleanHandler.cs',
          content: `
            return await _context.Products
              .AsNoTracking()
              .Where(p => p.CreatedAt >= startDate && p.CreatedAt < endDate)
              .OrderBy(p => p.Id)
              .Select(p => new ProductSummaryDto
              {
                Id = p.Id,
                Name = p.Name
              })
              .Take(100)
              .ToListAsync();
          `
        }
      ]
    });

    expect(result.filesAnalyzed).toBe(1);
    expect(result.filesWithIssues).toBe(0);
    expect(result.topRisks).toHaveLength(0);
    expect(result.highestSeverity).toBe('info');
  });

  it('should limit top risks to five files', () => {
    const files = Array.from({ length: 7 }, (_, index) => ({
      path: `Features/Orders/BadHandler${index + 1}.cs`,
      content: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .Select(o => new OrderSummaryDto
          {
            Id = o.Id
          })
          .ToListAsync();
      `
    }));

    const result = service.analyze({
      provider: 'ef-core',
      files
    });

    expect(result.filesAnalyzed).toBe(7);
    expect(result.topRisks).toHaveLength(5);
  });

  it('should handle empty content without throwing', () => {
    const result = service.analyze({
      provider: 'ef-core',
      files: [
        {
          path: 'Features/Empty.cs',
          content: ''
        }
      ]
    });

    expect(result.filesAnalyzed).toBe(1);
    expect(result.filesWithIssues).toBe(0);
    expect(result.results[0].score).toBe(0);
    expect(result.results[0].smellCount).toBe(0);
  });

  it('should ignore files without valid path', () => {
    const result = service.analyze({
      provider: 'ef-core',
      files: [
        {
          path: '',
          content: `
            return await _context.Orders
              .Where(o => o.OrderedAt.Year == currentYear)
              .ToListAsync();
          `
        }
      ]
    });

    expect(result.filesAnalyzed).toBe(0);
    expect(result.filesWithIssues).toBe(0);
    expect(result.summary).toBe('No files were analyzed.');
  });
});
