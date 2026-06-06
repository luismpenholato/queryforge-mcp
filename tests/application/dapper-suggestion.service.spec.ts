import { describe, expect, it } from 'vitest';
import { DapperSuggestionService } from '../../src/application/dapper-suggestion.service.js';
import { QueryAnalysisResult } from '../../src/domain/query-analysis-result.js';

const analysisWithProjection: QueryAnalysisResult = {
  summary: 'Found 1 issue. Overall severity: medium.',
  severity: 'medium',
  smells: [],
  recommendations: [],
  manualReviewRequired: false
};

describe('DapperSuggestionService', () => {
  const service = new DapperSuggestionService();

  it('should return a generic Product read-only Dapper template for projected queries', () => {
    const result = service.suggest(
      `
        return await _context.Products
          .Where(x => x.IsActive)
          .Select(x => new ProductSummaryDto
          {
            Id = x.Id,
            Name = x.Name,
            CategoryName = x.Category.Name
          })
          .ToListAsync();
      `,
      analysisWithProjection
    );

    expect(result).toContain('Example Dapper alternative');
    expect(result).toContain('FROM Products p');
    expect(result).toContain('LEFT JOIN Categories c');
    expect(result).toContain('WHERE p.IsActive = @IsActive');
    expect(result).toContain('QueryAsync<ProductSummaryDto>');
    expect(result).toContain('IsActive = true');
    expect(result).toContain('read-only queries');
    expect(result).not.toContain('SuaTabela');
    expect(result).not.toContain('Nome');
    expect(result).not.toContain('Ativo');
    expect(result).not.toContain('SeuDto');
  });

  it('should not suggest Dapper for write operations', () => {
    const result = service.suggest(
      `
        _context.Products.Add(newProduct);
        await _context.SaveChangesAsync();
      `,
      analysisWithProjection
    );

    expect(result).toContain('Não recomendo converter');
    expect(result).not.toContain('FROM Products');
  });

  it('should not generate template when projection is missing', () => {
    const result = service.suggest(
      'return await _context.Products.Where(x => x.IsActive).ToListAsync();',
      analysisWithProjection
    );

    expect(result).toContain('Conversão para Dapper não gerada');
    expect(result).not.toContain('FROM Products');
  });
});
