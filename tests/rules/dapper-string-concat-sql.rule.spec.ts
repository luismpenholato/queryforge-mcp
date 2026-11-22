import { describe, expect, it } from 'vitest';
import { dapperStringConcatSqlRule } from '../../src/rules/dapper-string-concat-sql.rule.js';

describe('dapperStringConcatSqlRule', () => {
  it('detects interpolated SQL with SELECT', () => {
    const result = dapperStringConcatSqlRule.analyze({
      provider: 'dapper',
      code: `
        var sql = $"SELECT Id, Name FROM Products WHERE CategoryId = {categoryId}";
        return connection.Query<Product>(sql);
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DAPPER_STRING_CONCAT_SQL');
  });

  it('detects concatenated SQL fragments with SELECT', () => {
    const result = dapperStringConcatSqlRule.analyze({
      provider: 'dapper',
      code: `
        var sql = "SELECT Id, Name FROM Products WHERE Name = '" + productName + "'";
        return connection.Query<Product>(sql);
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DAPPER_STRING_CONCAT_SQL');
  });

  it('allows parameterized SQL', () => {
    const result = dapperStringConcatSqlRule.analyze({
      provider: 'dapper',
      code: `
        const string sql = "SELECT Id, Name FROM Products WHERE CategoryId = @CategoryId";
        return connection.Query<Product>(sql, new { CategoryId = categoryId });
      `
    });

    expect(result).toHaveLength(0);
  });
});
