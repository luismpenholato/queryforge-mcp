import { describe, expect, it } from 'vitest';
import { IndexCandidateService } from '../../src/application/index-candidate.service.js';

describe('IndexCandidateService', () => {
  const service = new IndexCandidateService();

  const goodQuery = `
    return await _context.Orders
      .AsNoTracking()
      .Where(o =>
        o.CustomerId == customerId &&
        o.Status == status &&
        o.OrderedAt >= startDate &&
        o.OrderedAt < endDate)
      .OrderByDescending(o => o.OrderedAt)
      .ThenBy(o => o.Id)
      .Select(o => new OrderSummaryDto
      {
        Id = o.Id,
        CustomerId = o.CustomerId,
        Status = o.Status,
        OrderedAt = o.OrderedAt,
        TotalAmount = o.TotalAmount
      })
      .Take(100)
      .ToListAsync();
  `;

  it('should generate composite index for equality, range and ordering', () => {
    const result = service.suggest({
      code: goodQuery,
      databaseProvider: 'sql-server'
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].columns.map((column) => column.name)).toEqual([
      'CustomerId',
      'Status',
      'OrderedAt',
      'Id'
    ]);
    expect(result.candidates[0].sql).toContain('CREATE INDEX IX_Orders_CustomerId_Status_OrderedAt_Id');
    expect(result.candidates[0].sql).toContain('OrderedAt DESC');
    expect(result.manualReviewRequired).toBe(true);
  });

  it('should prioritize explicit tableName', () => {
    const result = service.suggest({
      code: goodQuery,
      databaseProvider: 'postgresql',
      tableName: 'SalesOrders'
    });

    expect(result.tableName).toBe('SalesOrders');
    expect(result.candidates[0].tableName).toBe('SalesOrders');
    expect(result.candidates[0].sql).toContain('ON SalesOrders');
  });

  it('should infer Orders from _context.Orders', () => {
    const result = service.suggest({
      code: goodQuery,
      databaseProvider: 'sql-server'
    });

    expect(result.tableName).toBe('Orders');
  });

  it('should infer Orders from OrderRepository.Query()', () => {
    const result = service.suggest({
      code: `
        return await unitOfWork.OrderRepository.Query()
          .Where(o => o.CustomerId == customerId && o.Status == status)
          .OrderByDescending(o => o.OrderedAt)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server'
    });

    expect(result.tableName).toBe('Orders');
    expect(result.candidates[0].columns.map((column) => column.name)).toContain('CustomerId');
  });

  it('should add warning and reduce confidence for function-on-column filters', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .OrderByDescending(o => o.OrderedAt)
          .Take(30000)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server'
    });

    expect(result.warnings.some((warning) => warning.includes('function-on-column'))).toBe(true);
    expect(result.candidates[0].columns.map((column) => column.name)).toContain('OrderedAt');
    expect(result.candidates[0].confidence).toBeLessThan(0.75);
  });

  it('should warn for ToString.Contains filters', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o => o.TotalAmount.ToString().Contains("3"))
          .OrderBy(o => o.OrderedAt)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server'
    });

    expect(result.warnings.some((warning) => warning.includes('String conversion'))).toBe(true);
    expect(result.analysisSmells).toContain('TO_STRING_IN_QUERY_FILTER');
  });

  it('should warn for cartesian product queries', () => {
    const result = service.suggest({
      code: `
        var query =
          from customer in _context.Customers
          from order in _context.Orders
          select new { customer.Id, order.Id };
      `,
      databaseProvider: 'sql-server'
    });

    expect(result.warnings.some((warning) => warning.includes('cartesian product'))).toBe(true);
    expect(result.analysisSmells).toContain('CARTESIAN_PRODUCT_QUERY');
  });

  it('should not break for unknown provider', () => {
    const result = service.suggest({
      code: goodQuery,
      databaseProvider: 'unknown'
    });

    expect(result.candidates[0].sql).toContain('Generic relational index candidate');
    expect(result.warnings.some((warning) => warning.includes('unknown'))).toBe(true);
  });

  it('should not generate relational SQL for cosmos provider', () => {
    const result = service.suggest({
      code: goodQuery,
      databaseProvider: 'cosmos'
    });

    expect(result.candidates[0].sql).toBeUndefined();
    expect(result.warnings.some((warning) => warning.includes('may not apply'))).toBe(true);
  });

  it('should return no candidates when no fields are detected', () => {
    const result = service.suggest({
      code: 'return await Task.CompletedTask;',
      databaseProvider: 'sql-server'
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.summary).toContain('No index candidates');
  });
});
