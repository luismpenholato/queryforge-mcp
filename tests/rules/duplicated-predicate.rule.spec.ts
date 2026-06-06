import { describe, expect, it } from 'vitest';
import { duplicatedPredicateRule } from '../../src/rules/duplicated-predicate.rule.js';

describe('duplicatedPredicateRule', () => {
  it('should detect duplicated predicate in Where', () => {
    const result = duplicatedPredicateRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.IsActive && c.IsActive)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DUPLICATED_PREDICATE');
    expect(result[0].safeAutoFix).toBe(true);
  });

  it('should not detect unique predicates', () => {
    const result = duplicatedPredicateRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.IsActive && c.StoreId == storeId)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
