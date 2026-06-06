import { describe, expect, it } from 'vitest';
import { missingAsNoTrackingRule } from '../../src/rules/missing-as-no-tracking.rule.js';

describe('missingAsNoTrackingRule', () => {
  it('should detect read-only query with projection and no AsNoTracking', () => {
    const result = missingAsNoTrackingRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto { Id = x.Id })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MISSING_AS_NO_TRACKING');
    expect(result[0].severity).toBe('medium');
    expect(result[0].confidence).toBe(0.75);
  });

  it('should detect read-only query when context indicates read-only', () => {
    const result = missingAsNoTrackingRule.analyze({
      provider: 'ef-core',
      context: 'read-only',
      code: `
        return await _context.Products
          .Where(x => x.IsActive)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MISSING_AS_NO_TRACKING');
    expect(result[0].confidence).toBe(0.55);
  });

  it('should not detect when AsNoTracking is present', () => {
    const result = missingAsNoTrackingRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .AsNoTracking()
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto { Id = x.Id })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect write operations', () => {
    const result = missingAsNoTrackingRule.analyze({
      provider: 'ef-core',
      code: `
        _context.Products.Add(newProduct);
        await _context.SaveChangesAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect non-EF code', () => {
    const result = missingAsNoTrackingRule.analyze({
      provider: 'dapper',
      code: `
        var sql = "SELECT Id FROM Products";
        return connection.Query<ProductSummaryDto>(sql);
      `
    });

    expect(result).toHaveLength(0);
  });
});
