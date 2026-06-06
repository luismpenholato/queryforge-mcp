import { describe, expect, it } from 'vitest';
import { countGreaterThanZeroRule } from '../../src/rules/count-greater-than-zero.rule.js';

describe('countGreaterThanZeroRule', () => {
  it('should detect Count() > 0', () => {
    const result = countGreaterThanZeroRule.analyze({
      provider: 'ef-core',
      code: 'return await _context.Products.Count() > 0;'
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('COUNT_GREATER_THAN_ZERO');
    expect(result[0].severity).toBe('medium');
  });

  it('should detect CountAsync() >= 1', () => {
    const result = countGreaterThanZeroRule.analyze({
      provider: 'ef-core',
      code: 'return await _context.Products.Where(x => x.IsActive).CountAsync() >= 1;'
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('COUNT_GREATER_THAN_ZERO');
  });

  it('should detect Count() != 0', () => {
    const result = countGreaterThanZeroRule.analyze({
      provider: 'ef-core',
      code: 'var total = query.Count() != 0;'
    });

    expect(result).toHaveLength(1);
  });

  it('should not detect Any()', () => {
    const result = countGreaterThanZeroRule.analyze({
      provider: 'ef-core',
      code: 'return await _context.Products.AnyAsync(x => x.IsActive);'
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect Count used for actual counting', () => {
    const result = countGreaterThanZeroRule.analyze({
      provider: 'ef-core',
      code: 'var total = await _context.Products.CountAsync();'
    });

    expect(result).toHaveLength(0);
  });
});
