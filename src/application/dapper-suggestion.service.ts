import { QueryAnalysisResult } from '../domain/query-analysis-result.js';

export class DapperSuggestionService {
  suggest(code: string, analysis: QueryAnalysisResult): string {
    const hasProjection = /\.Select\s*\(/.test(code);
    const hasWriteOperation =
      /\.Add\s*\(|\.Update\s*\(|\.Remove\s*\(|SaveChanges|SaveChangesAsync/.test(code);

    if (hasWriteOperation) {
      return [
        'Não recomendo converter esta query para Dapper automaticamente.',
        '',
        'Motivo: o trecho parece envolver operação de escrita ou tracking do EF.',
        'Dapper faz mais sentido para consultas read-only, relatórios ou projeções simples.'
      ].join('\n');
    }

    if (!hasProjection) {
      return [
        'Conversão para Dapper não gerada automaticamente.',
        '',
        'Motivo: não foi identificada uma projeção clara para DTO.',
        'Sugestão: informe o DTO esperado e os filtros principais para gerar uma query SQL parametrizada com segurança.'
      ].join('\n');
    }

    return [
      '/* Example Dapper alternative. Adjust table, columns and filters to match your real model. */',
      '',
      'const string sql = @"',
      'SELECT',
      '    p.Id,',
      '    p.Name,',
      '    c.Name AS CategoryName',
      'FROM Products p',
      'LEFT JOIN Categories c ON c.Id = p.CategoryId',
      'WHERE p.IsActive = @IsActive',
      'ORDER BY p.Id',
      '";',
      '',
      'var parameters = new',
      '{',
      '    IsActive = true',
      '};',
      '',
      'var result = await connection.QueryAsync<ProductSummaryDto>(sql, parameters);',
      '',
      'return result.ToList();',
      '',
      '/*',
      `Original analysis summary: ${analysis.summary}`,
      'Use this alternative only for read-only queries that do not depend on EF tracking/change tracker.',
      'Validate indexes, execution plan and generated behavior with real data before replacing EF Core.',
      '*/'
    ].join('\n');
  }
}
