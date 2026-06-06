import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';

const PATTERN =
  /\.AsEnumerable\s*\(\s*\)[\s\S]*\.(Where|Select|OrderBy|OrderByDescending|Skip|Take)\s*\(/;

export const asEnumerableBeforeQueryOperatorsRule: QueryRule = {
  code: 'AS_ENUMERABLE_BEFORE_QUERY_OPERATORS',

  analyze(request) {
    if (!PATTERN.test(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'AS_ENUMERABLE_BEFORE_QUERY_OPERATORS',
        title: 'AsEnumerable antes de operadores de query',
        severity: 'high',
        category: 'materialization',
        message:
          'A query usa AsEnumerable antes de Where, Select, OrderBy, Skip ou Take.',
        whyItMatters:
          'AsEnumerable força avaliação em memória e impede que filtros, projeção e paginação sejam executados no banco.',
        suggestion:
          'Evite trocar para LINQ em memória antes de aplicar filtros, projeções, ordenação ou paginação.',
        rewritePlan: [
          'Remova AsEnumerable() da chain ou mova-o para depois dos operadores que devem ir ao banco.',
          'Mantenha filtros e paginação no IQueryable.'
        ],
        safeAutoFix: false,
        confidence: 0.91
      })
    ];
  }
};
