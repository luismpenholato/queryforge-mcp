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

  it('should not generate Year as an index column', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .OrderByDescending(o => o.OrderedAt)
          .Take(30000)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server',
      tableName: 'Orders'
    });

    const columnNames = result.candidates[0].columns.map((column) => column.name);

    expect(columnNames).not.toContain('Year');
    expect(columnNames).toContain('OrderedAt');
    expect(result.candidates[0].sql).not.toContain('Year');
  });

  it('should generate conditional OrderedAt candidate for function-on-column filters', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .OrderByDescending(o => o.OrderedAt)
          .Take(30000)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server',
      tableName: 'Orders'
    });

    expect(result.warnings.some((warning) => warning.includes('function-on-column'))).toBe(true);
    expect(result.candidates[0].requiresQueryRewrite).toBe(true);
    expect(result.candidates[0].rewriteRequiredReason).toContain('rewritten');
    expect(result.candidates[0].sql).toContain('CREATE INDEX IX_Orders_OrderedAt');
    expect(result.candidates[0].sql).toContain('OrderedAt DESC');
    expect(result.candidates[0].confidence).toBeLessThan(0.75);
    expect(result.summary).toContain('After rewriting non-sargable filters');
    expect(result.summary).toContain('OrderedAt');
    expect(
      result.warnings.some((warning) =>
        warning.includes('maintenance cost without gain')
      )
    ).toBe(true);
  });

  it('should keep date ordering column and defer numeric columns blocked by ToString filters', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o =>
            o.OrderedAt.Year == currentYear &&
            o.TotalAmount.ToString().Contains("3"))
          .OrderByDescending(o => o.OrderedAt)
          .Take(30000)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server',
      tableName: 'Orders'
    });

    const columnNames = result.candidates[0].columns.map((column) => column.name);

    expect(columnNames).toEqual(['OrderedAt']);
    expect(columnNames).not.toContain('TotalAmount');
    expect(result.candidates[0].sql).toContain('CREATE INDEX IX_Orders_OrderedAt');
    expect(result.candidates[0].sql).not.toContain('TotalAmount');
    expect(
      result.candidates[0].reasons.some((reason) =>
        reason.includes('TotalAmount should not be added to the index')
      )
    ).toBe(true);
    expect(result.postRewriteEvaluation).toBeDefined();
    expect(result.postRewriteEvaluation?.join('\n')).toContain('first candidate is:');
    expect(result.postRewriteEvaluation?.join('\n')).toContain('IX_Orders_OrderedAt');
    expect(result.postRewriteEvaluation?.join('\n')).toContain('IX_Orders_OrderedAt_TotalAmount');
    expect(result.postRewriteEvaluation?.join('\n')).toContain(
      'TotalAmount should not be added to the index before that filter rewrite'
    );
    expect(result.summary).toContain('TotalAmount');
    expect(result.notRecommendedNotes?.join('\n')).toContain('TotalAmount');
    expect(result.notRecommendedNotes?.join('\n')).toContain('Normal B-tree indexes do not solve');
  });

  it('should provide post-rewrite evaluation for function-on-column without deferred columns', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .OrderByDescending(o => o.OrderedAt)
          .Take(30000)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server',
      tableName: 'Orders'
    });

    expect(result.postRewriteEvaluation).toBeDefined();
    expect(result.postRewriteEvaluation?.join('\n')).toContain('IX_Orders_OrderedAt');
    expect(result.notRecommendedNotes?.join('\n')).toContain('Function-on-column filters');
  });

  it('should warn for ToString.Contains filters and avoid ToString as index column', () => {
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
    expect(result.candidates[0].columns.map((column) => column.name)).not.toContain('ToString');
    expect(result.candidates[0].columns.map((column) => column.name)).not.toContain('TotalAmount');
    expect(result.candidates[0].requiresQueryRewrite).toBe(true);
  });

  it('should not generate ToLower as an index column', () => {
    const result = service.suggest({
      code: `
        return await _context.Customers
          .Where(c => c.Name.ToLower().Contains(search))
          .OrderBy(c => c.Name)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server'
    });

    const columnNames = result.candidates[0].columns.map((column) => column.name);

    expect(columnNames).not.toContain('ToLower');
    expect(result.warnings.some((warning) => warning.includes('String transformation'))).toBe(true);
    expect(result.candidates[0].requiresQueryRewrite).toBe(true);
  });

  it('should generate normal candidate for sargable range filters', () => {
    const result = service.suggest({
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt >= startDate && o.OrderedAt < endDate)
          .OrderByDescending(o => o.OrderedAt)
          .ToListAsync();
      `,
      databaseProvider: 'sql-server'
    });

    expect(result.candidates[0].columns.map((column) => column.name)).toContain('OrderedAt');
    expect(result.candidates[0].requiresQueryRewrite).toBeUndefined();
    expect(result.candidates[0].sql).toContain('CREATE INDEX IX_Orders_OrderedAt');
    expect(result.summary).not.toContain('conditional');
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
    expect(result.summary).toContain('No safe direct index candidate');
  });
});
