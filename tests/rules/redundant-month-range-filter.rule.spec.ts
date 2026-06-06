import { describe, expect, it } from 'vitest';
import { redundantMonthRangeFilterRule } from '../../src/rules/redundant-month-range-filter.rule.js';

describe('redundantMonthRangeFilterRule', () => {
  it('should detect month array 1..12 Contains filter', () => {
    const result = redundantMonthRangeFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }.Contains(o.OrderedAt.Month))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('REDUNDANT_MONTH_RANGE_FILTER');
    expect(result[0].safeAutoFix).toBe(true);
  });

  it('should not detect partial month filter', () => {
    const result = redundantMonthRangeFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => new[] { 1, 2, 3 }.Contains(o.OrderedAt.Month))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
