import { describe, expect, it } from 'vitest';
import { cartesianProductQueryRule } from '../../src/rules/cartesian-product-query.rule.js';

describe('cartesianProductQueryRule', () => {
  it('should detect multiple from clauses', () => {
    const result = cartesianProductQueryRule.analyze({
      provider: 'ef-core',
      code: `
        var query =
          from customer in _context.Customers
          from order in _context.Orders
          from product in _context.Products
          select new { customer.Id, order.Id, product.Name };
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('CARTESIAN_PRODUCT_QUERY');
    expect(result[0].category).toBe('cardinality');
  });

  it('should not detect explicit join query', () => {
    const result = cartesianProductQueryRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.CustomerId == customerId)
          .Select(o => new { o.Id, o.TotalAmount })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
