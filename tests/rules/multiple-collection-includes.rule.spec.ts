import { describe, expect, it } from 'vitest';
import { multipleCollectionIncludesRule } from '../../src/rules/multiple-collection-includes.rule.js';

describe('multipleCollectionIncludesRule', () => {
  it('should detect multiple Include calls', () => {
    const result = multipleCollectionIncludesRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Include(o => o.Customer)
          .Include(o => o.Invoice)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MULTIPLE_COLLECTION_INCLUDES');
  });

  it('should not detect single Include', () => {
    const result = multipleCollectionIncludesRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Include(o => o.Customer)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
