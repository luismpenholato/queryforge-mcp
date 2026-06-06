import { describe, expect, it } from 'vitest';
import { unnecessaryIncludeWithProjectionRule } from '../../src/rules/unnecessary-include-with-projection.rule.js';

describe('unnecessaryIncludeWithProjectionRule', () => {
  it('should detect Include with Select', () => {
    const result = unnecessaryIncludeWithProjectionRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Include(x => x.Category)
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto
          {
            Id = x.Id,
            Name = x.Name,
            CategoryName = x.Category.Name
          })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('UNNECESSARY_INCLUDE_WITH_PROJECTION');
    expect(result[0].severity).toBe('medium');
  });

  it('should not detect when only Include is used', () => {
    const result = unnecessaryIncludeWithProjectionRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Include(x => x.Category)
          .Where(x => x.IsActive)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect when only Select is used', () => {
    const result = unnecessaryIncludeWithProjectionRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Products
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto { Id = x.Id })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
