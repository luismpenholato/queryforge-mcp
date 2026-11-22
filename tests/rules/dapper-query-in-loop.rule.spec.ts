import { describe, expect, it } from 'vitest';
import { dapperQueryInLoopRule } from '../../src/rules/dapper-query-in-loop.rule.js';

describe('dapperQueryInLoopRule', () => {
  it('detects QueryAsync inside foreach', () => {
    const result = dapperQueryInLoopRule.analyze({
      provider: 'dapper',
      code: `
        foreach (var customerId in customerIds)
        {
          var orders = await connection.QueryAsync<Order>(
            "SELECT Id, Total FROM Orders WHERE CustomerId = @CustomerId",
            new { CustomerId = customerId });
        }
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DAPPER_QUERY_IN_LOOP');
    expect(result[0].severity).toBe('high');
    expect(result[0].range).toBeDefined();
    expect(result[0].range?.start).toBeGreaterThanOrEqual(0);
  });

  it('detects QueryMultipleAsync inside for loops', () => {
    const result = dapperQueryInLoopRule.analyze({
      provider: 'dapper',
      code: `
        for (var index = 0; index < customerIds.Length; index++)
        {
          using var grid = await connection.QueryMultipleAsync(
            "SELECT Id FROM Orders WHERE CustomerId = @CustomerId; SELECT Id FROM Invoices WHERE CustomerId = @CustomerId",
            new { CustomerId = customerIds[index] });
          var orders = grid.Read<Order>().ToList();
        }
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DAPPER_QUERY_IN_LOOP');
    expect(result[0].range).toBeDefined();
  });

  it('ignores batched query outside loop', () => {
    const result = dapperQueryInLoopRule.analyze({
      provider: 'dapper',
      code: `
        var orders = await connection.QueryAsync<Order>(
          "SELECT Id, CustomerId, Total FROM Orders WHERE CustomerId = ANY(@CustomerIds)",
          new { CustomerIds = customerIds });
      `
    });

    expect(result).toHaveLength(0);
  });
});
