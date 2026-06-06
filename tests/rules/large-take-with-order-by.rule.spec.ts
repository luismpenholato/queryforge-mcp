import { describe, expect, it } from 'vitest';
import { largeTakeWithOrderByRule } from '../../src/rules/large-take-with-order-by.rule.js';

describe('largeTakeWithOrderByRule', () => {
  it('should detect OrderBy with large Take', () => {
    const result = largeTakeWithOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .OrderByDescending(o => o.OrderedAt)
          .Take(30_000)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('LARGE_TAKE_WITH_ORDER_BY');
  });

  it('should not detect large Take without OrderBy', () => {
    const result = largeTakeWithOrderByRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Take(30_000)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
