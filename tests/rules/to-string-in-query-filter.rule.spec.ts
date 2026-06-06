import { describe, expect, it } from 'vitest';
import { toStringInQueryFilterRule } from '../../src/rules/to-string-in-query-filter.rule.js';

describe('toStringInQueryFilterRule', () => {
  it('should detect ToString in Where', () => {
    const result = toStringInQueryFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.TotalAmount.ToString().Contains("3"))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TO_STRING_IN_QUERY_FILTER');
    expect(result[0].category).toBe('sargability');
  });

  it('should not detect ToString outside Where', () => {
    const result = toStringInQueryFilterRule.analyze({
      provider: 'ef-core',
      code: `
        var label = order.TotalAmount.ToString();
        return label;
      `
    });

    expect(result).toHaveLength(0);
  });
});
