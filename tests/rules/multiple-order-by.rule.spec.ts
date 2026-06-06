import { describe, expect, it } from 'vitest';
import { multipleOrderByRule } from '../../src/rules/multiple-order-by.rule.js';

describe('multipleOrderByRule', () => {
  it('should detect multiple OrderBy calls', () => {
    const result = multipleOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .OrderBy(o => o.Customer.Name)
          .OrderBy(o => o.OrderedAt)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MULTIPLE_ORDER_BY');
    expect(result[0].category).toBe('ordering');
  });

  it('should not detect OrderBy followed by ThenBy', () => {
    const result = multipleOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .OrderBy(o => o.Customer.Name)
          .ThenBy(o => o.OrderedAt)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
