import { describe, expect, it } from 'vitest';
import { largeTakeRule } from '../../src/rules/large-take.rule.js';

describe('largeTakeRule', () => {
  it('should detect Take with underscore literal >= 10000', () => {
    const result = largeTakeRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .OrderBy(o => o.OrderedAt)
          .Take(30_000)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('LARGE_TAKE');
    expect(result[0].message).toContain('30000');
  });

  it('should not detect small Take values', () => {
    const result = largeTakeRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Take(100)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
