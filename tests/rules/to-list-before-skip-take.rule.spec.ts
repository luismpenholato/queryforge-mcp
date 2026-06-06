import { describe, expect, it } from 'vitest';
import { toListBeforeSkipTakeRule } from '../../src/rules/to-list-before-skip-take.rule.js';

describe('toListBeforeSkipTakeRule', () => {
  it('should detect ToList before Skip/Take', () => {
    const result = toListBeforeSkipTakeRule.analyze({
      provider: 'ef-core',
      code: `
        var orders = await _context.Orders.ToListAsync();
        return orders.Skip(10).Take(20).ToList();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TO_LIST_BEFORE_SKIP_TAKE');
  });

  it('should not detect Skip/Take before ToListAsync', () => {
    const result = toListBeforeSkipTakeRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .OrderBy(o => o.Id)
          .Skip(10)
          .Take(20)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
