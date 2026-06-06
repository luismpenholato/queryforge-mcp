import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';

const PATTERN = /\.(ToList|ToListAsync)\s*\(\s*\)[\s\S]*\.OrderBy(?:Descending)?\s*\(/;

export const toListBeforeOrderByRule: QueryRule = {
  code: 'TO_LIST_BEFORE_ORDER_BY',

  analyze(request) {
    if (!PATTERN.test(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'TO_LIST_BEFORE_ORDER_BY',
        title: 'Materialização antes da ordenação',
        severity: 'high',
        category: 'materialization',
        message: 'A query chama ToList/ToListAsync antes de OrderBy/OrderByDescending.',
        whyItMatters:
          'Ordenar em memória após materialização aumenta uso de RAM e impede sort no banco.',
        suggestion: 'Ordene no banco antes da materialização.',
        rewritePlan: [
          'Mova OrderBy/OrderByDescending para antes de ToList/ToListAsync.',
          'Use ThenBy para ordenação secundária estável quando necessário.'
        ],
        safeAutoFix: false,
        confidence: 0.9
      })
    ];
  }
};
