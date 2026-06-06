import { describe, expect, it } from 'vitest';
import { clientSideMethodInWhereRule } from '../../src/rules/client-side-method-in-where.rule.js';

describe('clientSideMethodInWhereRule', () => {
  it('should detect custom method in Where', () => {
    const result = clientSideMethodInWhereRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(x => IsValid(x.Name))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('CLIENT_SIDE_METHOD_IN_WHERE');
    expect(result[0].category).toBe('translation');
  });

  it('should not detect known string methods in Where', () => {
    const result = clientSideMethodInWhereRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Customers
          .Where(c => c.Name.StartsWith(prefix))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
