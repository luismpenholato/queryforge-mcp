import { describe, expect, it } from 'vitest';
import { functionOnColumnFilterRule } from '../../src/rules/function-on-column-filter.rule.js';

describe('functionOnColumnFilterRule', () => {
  it('should detect DateTime member in Where', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('FUNCTION_ON_COLUMN_FILTER');
    expect(result[0].severity).toBe('high');
    expect(result[0].category).toBe('sargability');
  });

  it('should not detect range filter on DateTime column', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt >= startDate && o.OrderedAt < endDate)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
