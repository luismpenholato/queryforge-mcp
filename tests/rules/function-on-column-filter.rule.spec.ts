import { describe, expect, it } from 'vitest';
import { functionOnColumnFilterRule } from '../../src/rules/function-on-column-filter.rule.js';

describe('functionOnColumnFilterRule', () => {
  it('should detect DateTime member in Where', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt.Year == currentYear)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('FUNCTION_ON_COLUMN_FILTER');
    expect(result[0].severity).toBe('high');
    expect(result[0].category).toBe('sargability');
  });

  it('should detect DateTime members in multiline Where with nested Contains', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o =>
              o.OrderedAt.Year == currentYear &&
              new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }.Contains(o.OrderedAt.Month) &&
              o.TotalAmount.ToString()!.Contains('3'))
          .ToListAsync();
      `
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((item) => item.code === 'FUNCTION_ON_COLUMN_FILTER')).toBe(true);
  });

  it('should detect Month inside Contains within Where', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => new[] { 1, 2, 3 }.Contains(o.OrderedAt.Month))
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
  });

  it('should detect CreatedAt.Date and CreatedAt.Hour in Where', () => {
    const dateResult = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.CreatedAt.Date == today)
          .ToListAsync();
      `
    });

    const hourResult = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.CreatedAt.Hour >= 8)
          .ToListAsync();
      `
    });

    expect(dateResult).toHaveLength(1);
    expect(hourResult).toHaveLength(1);
  });

  it('should not detect DateTime members outside Where', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        var year = date.Year;
        var month = request.Month;
        return await _context.Orders
          .Where(o => o.OrderedAt >= start && o.OrderedAt < end)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });

  it('should not detect range filter on DateTime column', () => {
    const result = functionOnColumnFilterRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.Orders
          .Where(o => o.OrderedAt >= startDate && o.OrderedAt < endDate)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
