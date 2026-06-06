import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EfRewriteService } from '../../src/application/ef-rewrite.service.js';
import { QueryAnalysisService } from '../../src/application/query-analysis.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionOnColumnQuery = readFileSync(
  join(__dirname, '../../examples/function-on-column-query.cs'),
  'utf-8'
);

describe('EfRewriteService', () => {
  const analysisService = new QueryAnalysisService();
  const rewriteService = new EfRewriteService();

  it('should not alter code when there are no smells', () => {
    const code = `
      return await _context.Products
        .AsNoTracking()
        .Where(x => x.IsActive)
        .Select(x => new ProductSummaryDto { Id = x.Id })
        .ToListAsync();
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(analysis.smells).toHaveLength(0);
    expect(result).toBe(code);
    expect(result).not.toContain('QueryForge EF rewrite suggestion');
  });

  it('should add AsNoTracking for a simple read-only query', () => {
    const code = `
      return await _context.Products
        .Where(x => x.IsActive)
        .Select(x => new ProductSummaryDto { Id = x.Id })
        .ToListAsync();
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).toContain('Safe automatic rewrite: yes');
    expect(result).toContain('Added AsNoTracking()');
    expect(result).toContain('.AsNoTracking()');
    expect(result).not.toContain('Manual review required:');
  });

  it('should convert Count greater than zero to Any', () => {
    const code = 'return await _context.Orders.CountAsync() > 0;';
    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).toContain('Safe automatic rewrite: yes');
    expect(result).toContain('Any/AnyAsync');
    expect(result).toContain('.AnyAsync()');
    expect(result).not.toContain('.CountAsync() > 0');
  });

  it('should return a range-filter plan for FUNCTION_ON_COLUMN_FILTER without rewriting the filter', () => {
    const code = `
      return await _context.Orders
        .Where(o => o.OrderedAt.Year == currentYear)
        .ToListAsync();
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).toContain('Manual review required:');
    expect(result).toContain('FUNCTION_ON_COLUMN_FILTER');
    expect(result).toContain('Suggested rewrite plan:');
    expect(result).toContain('Conceptual example for DateTime.Year/Month:');
    expect(result).toContain('o.OrderedAt.Year == currentYear');
    expect(result).not.toContain('o.OrderedAt >= startDate');
  });

  it('should warn that ToString and Contains-on-converted filters have no safe auto-fix', () => {
    const code = `
      return await _context.Orders
        .Where(o => o.TotalAmount.ToString().Contains("3"))
        .ToListAsync();
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).toContain('Safe automatic rewrite: no');
    expect(result).toContain('TO_STRING_IN_QUERY_FILTER');
    expect(result).toContain('CONTAINS_ON_CONVERTED_VALUE');
    expect(result).toContain('Why automatic rewrite was not fully applied:');
    expect(result).toContain('Note on ToString/Contains filters:');
    expect(result).toContain('o.TotalAmount.ToString().Contains("3")');
  });

  it('should apply partial rewrite with AsNoTracking and plan for non-sargable filters', () => {
    const analysis = analysisService.analyze({
      provider: 'ef-core',
      code: functionOnColumnQuery
    });

    const result = rewriteService.suggest(functionOnColumnQuery, analysis);

    expect(result).toContain('Safe automatic rewrite: partial');
    expect(result).toContain('Added AsNoTracking()');
    expect(result).toContain('.AsNoTracking()');
    expect(result).toContain('FUNCTION_ON_COLUMN_FILTER');
    expect(result).toContain('TO_STRING_IN_QUERY_FILTER');
    expect(result).toContain('CONTAINS_ON_CONVERTED_VALUE');
    expect(result).toContain('LARGE_TAKE_WITH_ORDER_BY');
    expect(result).toContain('Suggested rewrite plan:');
    expect(result).toContain('Conceptual example for DateTime.Year/Month:');
    expect(result).toContain('o.OrderedAt.Year == currentYear');
    expect(result).toContain('o.TotalAmount.ToString()!.Contains');
  });
});
