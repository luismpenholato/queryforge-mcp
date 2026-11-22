import { describe, expect, it } from 'vitest';
import { aggregationAfterMaterializationRule } from '../../src/rules/aggregation-after-materialization.rule.js';

describe('aggregationAfterMaterializationRule', () => {
  it('detects Sum after ToListAsync', () => {
    const result = aggregationAfterMaterializationRule.analyze({
      provider: 'ef-core',
      code: `
        var total = (await _context.Orders
          .Where(o => o.CustomerId == customerId)
          .ToListAsync())
          .Sum(o => o.Total);
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('AGGREGATION_AFTER_MATERIALIZATION');
  });

  it('detects Average after AsEnumerable', () => {
    const result = aggregationAfterMaterializationRule.analyze({
      provider: 'ef-core',
      code: `
        var average = _context.Orders
          .Where(o => o.CustomerId == customerId)
          .AsEnumerable()
          .Average(o => o.Total);
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('AGGREGATION_AFTER_MATERIALIZATION');
  });

  it('ignores server-side SumAsync', () => {
    const result = aggregationAfterMaterializationRule.analyze({
      provider: 'ef-core',
      code: `
        var total = await _context.Orders
          .Where(o => o.CustomerId == customerId)
          .SumAsync(o => o.Total);
      `
    });

    expect(result).toHaveLength(0);
  });
});
