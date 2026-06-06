import { describe, expect, it } from 'vitest';
import { toListBeforeWhereRule } from '../../src/rules/to-list-before-where.rule.js';

describe('toListBeforeWhereRule', () => {
  it('should detect ToListAsync before Where', () => {
    const result = toListBeforeWhereRule.analyze({
      provider: 'ef-core',
      code: `
        var orders = await _context.Orders.ToListAsync();
        return orders.Where(o => o.IsActive).ToList();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TO_LIST_BEFORE_WHERE');
    expect(result[0].category).toBe('materialization');
  });

  it('should not detect Where before ToListAsync', () => {
    const result = toListBeforeWhereRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.IsActive)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
