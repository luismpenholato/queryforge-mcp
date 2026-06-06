import { describe, expect, it } from 'vitest';
import { implicitConversionInFilterRule } from '../../src/rules/implicit-conversion-in-filter.rule.js';

describe('implicitConversionInFilterRule', () => {
  it('should detect ToString inside Where', () => {
    const result = implicitConversionInFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.LegacyCode == c.Id.ToString())
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('IMPLICIT_CONVERSION_IN_FILTER');
    expect(result[0].category).toBe('sargability');
  });

  it('should not detect same-type comparison', () => {
    const result = implicitConversionInFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.LegacyCode == legacyCode)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
