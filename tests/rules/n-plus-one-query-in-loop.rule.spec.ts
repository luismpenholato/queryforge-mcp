import { describe, expect, it } from 'vitest';
import { nPlusOneQueryInLoopRule } from '../../src/rules/n-plus-one-query-in-loop.rule.js';

describe('nPlusOneQueryInLoopRule', () => {
  it('should detect query execution inside foreach', () => {
    const result = nPlusOneQueryInLoopRule.analyze({
      provider: 'ef-core',
      code: `
        foreach (var customer in customers)
        {
          var orders = await _context.Orders
            .Where(o => o.CustomerId == customer.Id)
            .ToListAsync();
        }
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('N_PLUS_ONE_QUERY_IN_LOOP');
    expect(result[0].category).toBe('round-trips');
  });

  it('should not detect query outside loop', () => {
    const result = nPlusOneQueryInLoopRule.analyze({
      provider: 'ef-core',
      code: `
        var customerIds = customers.Select(c => c.Id).ToList();
        return await _context.Orders
          .Where(o => customerIds.Contains(o.CustomerId))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
