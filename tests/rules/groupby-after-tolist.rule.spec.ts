import { describe, expect, it } from 'vitest';
import { groupByAfterToListRule } from '../../src/rules/groupby-after-tolist.rule.js';

describe('groupByAfterToListRule', () => {
  it('detects GroupBy after ToList', () => {
    const result = groupByAfterToListRule.analyze({
      provider: 'ef-core',
      code: `
        var groups = _context.Orders
          .Where(o => o.IsActive)
          .ToList()
          .GroupBy(o => o.CustomerId);
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('GROUPBY_AFTER_TOLIST');
  });

  it('ignores GroupBy before materialization', () => {
    const result = groupByAfterToListRule.analyze({
      provider: 'ef-core',
      code: `
        var groups = await _context.Orders
          .Where(o => o.IsActive)
          .GroupBy(o => o.CustomerId)
          .Select(g => new { CustomerId = g.Key, Count = g.Count() })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
