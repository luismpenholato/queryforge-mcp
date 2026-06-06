import { describe, expect, it } from 'vitest';
import { toListBeforeOrderByRule } from '../../src/rules/to-list-before-order-by.rule.js';

describe('toListBeforeOrderByRule', () => {
  it('should detect ToList before OrderBy', () => {
    const result = toListBeforeOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        var orders = await _context.Orders.ToListAsync();
        return orders.OrderBy(o => o.OrderedAt).ToList();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TO_LIST_BEFORE_ORDER_BY');
  });

  it('should not detect OrderBy before ToListAsync', () => {
    const result = toListBeforeOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .OrderBy(o => o.OrderedAt)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
