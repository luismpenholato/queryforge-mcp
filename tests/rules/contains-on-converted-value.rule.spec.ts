import { describe, expect, it } from 'vitest';
import { containsOnConvertedValueRule } from '../../src/rules/contains-on-converted-value.rule.js';

describe('containsOnConvertedValueRule', () => {
  it('should detect ToString().Contains in Where', () => {
    const result = containsOnConvertedValueRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.TotalAmount.ToString().Contains("3"))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('CONTAINS_ON_CONVERTED_VALUE');
  });

  it('should not detect Contains on native string column', () => {
    const result = containsOnConvertedValueRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.Name.Contains(search))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
