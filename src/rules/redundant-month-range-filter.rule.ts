import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasRedundantMonthRangeFilter } from './rule-helpers.js';

export const redundantMonthRangeFilterRule: QueryRule = {
  code: 'REDUNDANT_MONTH_RANGE_FILTER',

  analyze(request) {
    if (!hasRedundantMonthRangeFilter(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'REDUNDANT_MONTH_RANGE_FILTER',
        title: 'Filtro redundante de meses 1 a 12',
        severity: 'low',
        category: 'redundant-filter',
        message:
          'A query filtra Month com lista contendo todos os meses (1..12), o que é redundante para DateTime válido.',
        whyItMatters:
          'Filtros redundantes adicionam complexidade ao SQL sem reduzir o conjunto de resultados.',
        suggestion:
          'Remova o filtro de meses 1..12 a menos que exista motivo específico de negócio.',
        rewritePlan: [
          'Remova o Contains com array de meses 1..12.',
          'Mantenha apenas filtros que reduzem o conjunto de dados.'
        ],
        safeAutoFix: true,
        confidence: 0.93
      })
    ];
  }
};
