import { describe, expect, it } from 'vitest';
import { paginationWithoutOrderByRule } from '../../src/rules/pagination-without-orderby.rule.js';

describe('paginationWithoutOrderByRule', () => {
  it('should detect Skip/Take without OrderBy', () => {
    const result = paginationWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.IsActive)
          .Skip(page * pageSize)
          .Take(pageSize)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('PAGINATION_WITHOUT_ORDER_BY');
    expect(result[0].severity).toBe('high');
  });

  it('should detect Take without OrderBy', () => {
    const result = paginationWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: 'return await _context.Products.Take(10).ToListAsync();'
    });

    expect(result).toHaveLength(1);
  });

  it('should not detect when OrderBy is present', () => {
    const result = paginationWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .OrderBy(x => x.Id)
          .Skip(page * pageSize)
          .Take(pageSize)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect when ThenBy is present', () => {
    const result = paginationWithoutOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .OrderBy(x => x.Name)
          .ThenBy(x => x.Id)
          .Skip(page * pageSize)
          .Take(pageSize)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
