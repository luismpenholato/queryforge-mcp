import { describe, expect, it } from 'vitest';
import { asEnumerableBeforeQueryOperatorsRule } from '../../src/rules/as-enumerable-before-query-operators.rule.js';

describe('asEnumerableBeforeQueryOperatorsRule', () => {
  it('should detect AsEnumerable before Where', () => {
    const result = asEnumerableBeforeQueryOperatorsRule.analyze({
      provider: 'ef-core',
      code: `
        return _context.Orders
          .AsEnumerable()
          .Where(o => o.IsActive)
          .ToList();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('AS_ENUMERABLE_BEFORE_QUERY_OPERATORS');
  });

  it('should not detect when only materialization follows AsEnumerable', () => {
    const result = asEnumerableBeforeQueryOperatorsRule.analyze({
      provider: 'ef-core',
      code: `
        return _context.Orders
          .Where(o => o.IsActive)
          .OrderBy(o => o.OrderedAt)
          .AsEnumerable()
          .ToList();
      `
    });

    expect(result).toHaveLength(0);
  });
});
