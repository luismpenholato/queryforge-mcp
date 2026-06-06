import { QueryRule } from '../domain/query-rule.js';

export const paginationWithoutOrderByRule: QueryRule = {
  code: 'PAGINATION_WITHOUT_ORDER_BY',

  analyze(request) {
    const code = request.code;

    const hasPagination = /\.Skip\s*\(|\.Take\s*\(/.test(code);
    const hasOrderBy = /\.OrderBy\s*\(|\.OrderByDescending\s*\(|\.ThenBy\s*\(|\.ThenByDescending\s*\(/.test(code);

    if (!hasPagination || hasOrderBy) {
      return [];
    }

    return [
      {
        code: 'PAGINATION_WITHOUT_ORDER_BY',
        title: 'Paginação sem ordenação explícita',
        severity: 'high',
        message:
          'A query usa Skip/Take sem OrderBy. Isso pode gerar resultados instáveis entre execuções.',
        suggestion:
          'Adicione OrderBy antes de Skip/Take usando uma coluna determinística, como Id ou DataCriacao.',
        confidence: 0.9
      }
    ];
  }
};
