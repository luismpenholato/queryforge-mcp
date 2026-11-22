import { describe, expect, it } from 'vitest';
import { dapperSelectStarRule } from '../../src/rules/dapper-select-star.rule.js';

describe('dapperSelectStarRule', () => {
  it('detects SELECT * in Dapper queries', () => {
    const result = dapperSelectStarRule.analyze({
      provider: 'dapper',
      code: `
        var products = await connection.QueryAsync<Product>(
          "SELECT * FROM Products WHERE IsActive = @IsActive",
          new { IsActive = true });
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DAPPER_SELECT_STAR');
  });

  it('ignores explicit column lists', () => {
    const result = dapperSelectStarRule.analyze({
      provider: 'dapper',
      code: `
        return connection.Query<ProductSummary>(
          "SELECT Id, Name FROM Products WHERE IsActive = @IsActive",
          new { IsActive = true });
      `
    });

    expect(result).toHaveLength(0);
  });
});
