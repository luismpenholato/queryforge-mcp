import { describe, expect, it } from 'vitest';
import { correlatedSubqueryInProjectionRule } from '../../src/rules/correlated-subquery-in-projection.rule.js';

describe('correlatedSubqueryInProjectionRule', () => {
  it('should detect correlated Count inside Select', () => {
    const result = correlatedSubqueryInProjectionRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Select(c => new CustomerSummaryDto
          {
            Id = c.Id,
            OrderCount = _context.Orders.Count(o => o.CustomerId == c.Id)
          })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('CORRELATED_SUBQUERY_IN_PROJECTION');
  });

  it('should not detect simple projection', () => {
    const result = correlatedSubqueryInProjectionRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Select(c => new CustomerSummaryDto
          {
            Id = c.Id,
            Name = c.Name
          })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
