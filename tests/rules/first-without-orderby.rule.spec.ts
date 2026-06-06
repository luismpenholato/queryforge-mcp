import { describe, expect, it } from 'vitest';
import { firstWithoutOrderByRule } from '../../src/rules/first-without-orderby.rule.js';

describe('firstWithoutOrderByRule', () => {
  it('should detect FirstOrDefaultAsync without OrderBy', () => {
    const result = firstWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.Sku == sku)
          .FirstOrDefaultAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('FIRST_WITHOUT_ORDER_BY');
    expect(result[0].severity).toBe('low');
  });

  it('should detect First without OrderBy', () => {
    const result = firstWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: 'return query.Where(x => x.IsActive).First();'
    });

    expect(result).toHaveLength(1);
  });

  it('should not detect when OrderBy is present', () => {
    const result = firstWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.Sku == sku)
          .OrderBy(x => x.Id)
          .FirstOrDefaultAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect when OrderByDescending is present', () => {
    const result = firstWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .OrderByDescending(x => x.CreatedAt)
          .FirstAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
