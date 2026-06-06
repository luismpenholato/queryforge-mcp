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
    expect(result).toContain('new DateTime(currentYear, 1, 1, 0, 0, 0, DateTimeKind.Utc)');
    expect(result).toContain('query.Where(o => o.OrderedAt >= startDate && o.OrderedAt < endDate)');

    const rewrittenCode = result.split('*/').pop() ?? '';
    expect(rewrittenCode).toContain('o.OrderedAt.Year == currentYear');
    expect(rewrittenCode).not.toContain('o.OrderedAt >= startDate');
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
    expect(result).toContain('var items = await query');
    expect(result).toContain('.ToListAsync(ct);');
    expect(result).toContain('return items');
    expect(result).toContain('.Where(x => /* business rule not translatable to SQL */)');
    expect(result).not.toContain('ContinueWith');
    expect(result).toContain(
      'Only do this after a selective indexed filter significantly reduces the result set.'
    );
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
    expect(result).toContain('Conceptual rewrite example (not auto-applied):');
    expect(result).toContain('var items = await _context.Orders');
    expect(result).toContain('new DateTime(currentYear, 1, 1, 0, 0, 0, DateTimeKind.Utc)');
    expect(result).toContain('o.OrderedAt >= startDate && o.OrderedAt < endDate');
    expect(result).toContain('return items');
    expect(result).toContain('System.Globalization.CultureInfo.InvariantCulture');
    expect(result).toContain('.Where(o =>');
    expect(result).toContain('o.TotalAmount');
    expect(result).toContain('.ToString(System.Globalization.CultureInfo.InvariantCulture)');
    expect(result).toContain(".Contains('3')");
    expect(result).not.toContain('ContinueWith');
    expect(result).not.toContain('Conceptual example for selective in-memory filter');
    expect(result).toContain('Note on Take SQL translation:');
    expect(result).toContain('TOP or OFFSET/FETCH depending on provider and version');
    expect(result).toContain(
      'Only do this after a selective indexed filter significantly reduces the result set.'
    );
    expect(result).toContain('Note on Take before in-memory filter:');
    expect(result).toContain('applying Take before the in-memory filter does not change the business rule');
    expect(result).toContain('validate semantics before production');
  });

  it('should never emit ContinueWith even when input code contains it', () => {
    const code = `
      return await _context.Orders
        .Where(o => o.TotalAmount.ToString().Contains("3"))
        .ToListAsync(ct)
        .ContinueWith(t => t.Result.Where(o => o.TotalAmount > 0).ToList(), ct);
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).not.toContain('ContinueWith');
    expect(result).toContain('var items = await');
  });

  it('should format integrated rewrite example for repository-based queries', () => {
    const code = `
      var pedidos = await unitOfWork.PedidoRepository.Query()
        .Where(p => p.DataPedido.Year == currentYear && p.ValorTotal.ToString().Contains("3"))
        .OrderByDescending(p => p.DataPedido)
        .Take(30_000)
        .ToListAsync(ct);
      return pedidos;
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).not.toContain('ContinueWith');
    expect(result).toContain('var items = await unitOfWork.PedidoRepository.Query()');
    expect(result).toContain('new DateTime(currentYear, 1, 1, 0, 0, 0, DateTimeKind.Utc)');
    expect(result).toContain('p.DataPedido >= startDate && p.DataPedido < endDate');
    expect(result).toContain('return items');
    expect(result).toContain('.Where(p =>');
    expect(result).toContain('p.ValorTotal');
    expect(result).toContain('.ToString(System.Globalization.CultureInfo.InvariantCulture)');
    expect(result).toContain('.Contains("3")');

    const conceptualPlan = result.split('*/')[0];
    expect(conceptualPlan).not.toMatch(/(?<!System\.Globalization\.)CultureInfo\.InvariantCulture/);
    expect(conceptualPlan).toContain('Note on Take before in-memory filter:');
    expect(conceptualPlan).toContain('the returned volume does not pressure memory or latency');
  });

  it('should use UTC boundaries when year filter references DateTime.UtcNow.Year', () => {
    const code = `
      return await _context.Orders
        .Where(o => o.OrderedAt.Year == DateTime.UtcNow.Year)
        .ToListAsync();
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    expect(result).toContain('var year = DateTime.UtcNow.Year;');
    expect(result).toContain('new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);');
    expect(result).not.toContain('ContinueWith');
  });

  it('should never emit unqualified ToString(CultureInfo.InvariantCulture) in conceptual plan', () => {
    const code = `
      return await unitOfWork.PedidoRepository.Query()
        .Where(p =>
            p.DataPedido.Year == anoAtual &&
            new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }.Contains(p.DataPedido.Month) &&
            p.ValorTotal.ToString()!.Contains('3'))
        .OrderByDescending(p => p.DataPedido)
        .Take(30_000)
        .ToListAsync(ct);
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);
    const conceptualPlan = result.split('*/')[0];

    expect(result).not.toContain('ToString(CultureInfo.InvariantCulture)');
    expect(conceptualPlan).toContain('System.Globalization.CultureInfo.InvariantCulture');
    expect(conceptualPlan).toContain('p.ValorTotal');
    expect(conceptualPlan).toContain('.ToString(System.Globalization.CultureInfo.InvariantCulture)');
    expect(conceptualPlan).not.toMatch(/(?<!System\.Globalization\.)CultureInfo\.InvariantCulture/);
    expect(conceptualPlan).toContain('Note on Take before in-memory filter:');
  });

  it('should qualify CultureInfo.InvariantCulture in conceptual examples', () => {
    const code = `
      return await _context.Orders
        .Where(o =>
          o.OrderedAt.Year == currentYear &&
          o.TotalAmount.ToString(CultureInfo.InvariantCulture).Contains("3"))
        .OrderByDescending(o => o.OrderedAt)
        .ToListAsync(ct);
    `;

    const analysis = analysisService.analyze({ provider: 'ef-core', code });
    const result = rewriteService.suggest(code, analysis);

    const conceptualPlan = result.split('*/')[0];

    expect(conceptualPlan).toContain('System.Globalization.CultureInfo.InvariantCulture');
    expect(conceptualPlan).toContain('.ToString(System.Globalization.CultureInfo.InvariantCulture)');
    expect(conceptualPlan).toContain('.Contains("3")');
    expect(result).not.toContain('ToString(CultureInfo.InvariantCulture)');
    expect(conceptualPlan).not.toMatch(/(?<!System\.Globalization\.)CultureInfo\.InvariantCulture/);
    expect(result).not.toContain('ContinueWith');
  });
});
