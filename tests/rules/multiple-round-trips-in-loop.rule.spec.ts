import { describe, expect, it } from 'vitest';
import { multipleRoundTripsInLoopRule } from '../../src/rules/multiple-round-trips-in-loop.rule.js';

describe('multipleRoundTripsInLoopRule', () => {
  it('should detect multiple queries inside the same loop', () => {
    const result = multipleRoundTripsInLoopRule.analyze({
      provider: 'ef-core',
      code: `
        foreach (var customer in customers)
        {
          var orders = await _context.Orders.Where(o => o.CustomerId == customer.Id).ToListAsync();
          var invoices = await _context.Invoices.Where(i => i.CustomerId == customer.Id).ToListAsync();
        }
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MULTIPLE_ROUND_TRIPS_IN_LOOP');
  });

  it('should not detect a single query inside loop', () => {
    const result = multipleRoundTripsInLoopRule.analyze({
      provider: 'ef-core',
      code: `
        foreach (var customer in customers)
        {
          var orders = await _context.Orders.Where(o => o.CustomerId == customer.Id).ToListAsync();
        }
      `
    });

    expect(result).toHaveLength(0);
  });
});
