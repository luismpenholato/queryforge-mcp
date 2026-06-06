import { describe, expect, it } from 'vitest';
import { toListBeforeSelectRule } from '../../src/rules/to-list-before-select.rule.js';

describe('toListBeforeSelectRule', () => {
  it('should detect ToListAsync before Select', () => {
    const result = toListBeforeSelectRule.analyze({
      provider: 'ef-core',
      code: `
        var products = await _context.Products
          .Where(x => x.IsActive)
          .ToListAsync();

        return products.Select(x => new ProductSummaryDto
        {
          Id = x.Id,
          Name = x.Name
        }).ToList();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TO_LIST_BEFORE_SELECT');
    expect(result[0].severity).toBe('high');
  });

  it('should detect ToList before Select', () => {
    const result = toListBeforeSelectRule.analyze({
      provider: 'ef-core',
      code: `
        var items = query.ToList();
        return items.Select(x => x.Name).ToList();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TO_LIST_BEFORE_SELECT');
  });

  it('should not detect when Select is before ToListAsync', () => {
    const result = toListBeforeSelectRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto
          {
            Id = x.Id,
            Name = x.Name
          })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect when only ToListAsync is used without later Select', () => {
    const result = toListBeforeSelectRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.IsActive)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
