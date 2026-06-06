import { describe, expect, it } from 'vitest';
import { stringTransformOnColumnFilterRule } from '../../src/rules/string-transform-on-column-filter.rule.js';

describe('stringTransformOnColumnFilterRule', () => {
  it('should detect ToLower in Where', () => {
    const result = stringTransformOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.Name.ToLower() == name.ToLower())
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('STRING_TRANSFORM_ON_COLUMN_FILTER');
    expect(result[0].category).toBe('sargability');
  });

  it('should not detect direct string comparison', () => {
    const result = stringTransformOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.Name == name)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
