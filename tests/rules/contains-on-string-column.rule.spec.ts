import { describe, expect, it } from 'vitest';
import { containsOnStringColumnRule } from '../../src/rules/contains-on-string-column.rule.js';

describe('containsOnStringColumnRule', () => {
  it('should detect Contains on string property in Where', () => {
    const result = containsOnStringColumnRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.Name.Contains(search))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('CONTAINS_ON_STRING_COLUMN');
    expect(result[0].severity).toBe('medium');
  });

  it('should not detect collection Contains in Where', () => {
    const result = containsOnStringColumnRule.analyze({
      provider: 'ef-core',
      code: `
        var ids = new[] { 1, 2, 3 };
        return await _context.Orders
          .Where(o => ids.Contains(o.Id))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
