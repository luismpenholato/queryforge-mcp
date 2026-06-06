import { describe, expect, it } from 'vitest';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

describe('QueryAnalysisService', () => {
  const service = new QueryAnalysisService();

  it('should return no smells for a clean query', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .AsNoTracking()
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto { Id = x.Id, Name = x.Name })
          .ToListAsync();
      `
    });

    expect(result.smells).toHaveLength(0);
    expect(result.severity).toBe('info');
    expect(result.manualReviewRequired).toBe(false);
    expect(result.summary).toContain('Nenhum problema');
    expect(result.recommendations).toHaveLength(0);
  });

  it('should aggregate multiple smells', () => {
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

    const codes = result.smells.map((s) => s.code);
    expect(codes).toContain('TO_LIST_BEFORE_SELECT');
    expect(codes).toContain('UNNECESSARY_INCLUDE_WITH_PROJECTION');
    expect(codes).toContain('PAGINATION_WITHOUT_ORDER_BY');
    expect(result.smells.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendations).toHaveLength(result.smells.length);
  });

  it('should resolve overall severity as high when a high smell exists', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: `
        var items = await _context.Orders.ToListAsync();
        return items.Select(x => x.Id).ToList();
      `
    });

    expect(result.severity).toBe('high');
    expect(result.summary).toContain('Severidade geral: high');
  });

  it('should set manualReviewRequired when severity is high', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Skip(0)
          .Take(10)
          .ToListAsync();
      `
    });

    expect(result.manualReviewRequired).toBe(true);
  });

  it('should set manualReviewRequired when confidence is below 0.75', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.Sku == sku)
          .FirstOrDefaultAsync();
      `
    });

    expect(result.smells.some((s) => s.code === 'FIRST_WITHOUT_ORDER_BY')).toBe(true);
    expect(result.manualReviewRequired).toBe(true);
  });

  it('should not require manual review for medium smell with high confidence only', () => {
    const result = service.analyze({
      provider: 'ef-core',
      code: 'return await _context.Products.CountAsync() > 0;'
    });

    expect(result.smells).toHaveLength(1);
    expect(result.smells[0].severity).toBe('medium');
    expect(result.smells[0].confidence).toBe(0.9);
    expect(result.manualReviewRequired).toBe(false);
  });
});
