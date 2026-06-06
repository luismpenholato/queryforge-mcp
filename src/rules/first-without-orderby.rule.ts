import { QueryRule } from '../domain/query-rule.js';

export const firstWithoutOrderByRule: QueryRule = {
  code: 'FIRST_WITHOUT_ORDER_BY',

  analyze(request) {
    const code = request.code;

    const hasFirst = /\.(First|FirstOrDefault|FirstAsync|FirstOrDefaultAsync)\s*\(/.test(code);
    const hasOrderBy = /\.OrderBy\s*\(|\.OrderByDescending\s*\(/.test(code);

    if (!hasFirst || hasOrderBy) {
      return [];
    }

    return [
      {
        code: 'FIRST_WITHOUT_ORDER_BY',
        title: 'First sem ordenação explícita',
        severity: 'low',
        message:
          'A query usa First/FirstOrDefault sem OrderBy. Se a ordem for importante, o resultado pode ser não determinístico.',
        suggestion:
          'Adicione OrderBy/OrderByDescending quando a regra de negócio depender de uma ordem específica.',
        confidence: 0.65
      }
    ];
  }
};
