import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';

const PATTERN = /\.(ToList|ToListAsync)\s*\(\s*\)[\s\S]*\.Where\s*\(/;

export const toListBeforeWhereRule: QueryRule = {
  code: 'TO_LIST_BEFORE_WHERE',

  analyze(request) {
    if (!PATTERN.test(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'TO_LIST_BEFORE_WHERE',
        title: 'Materialização antes do filtro',
        severity: 'high',
        category: 'materialization',
        message: 'A query chama ToList/ToListAsync antes do Where.',
        whyItMatters:
          'Filtrar após materialização traz dados desnecessários do banco e aplica o filtro em memória.',
        suggestion: 'Mova Where antes de ToList/ToListAsync.',
        rewritePlan: [
          'Reordene a chain LINQ colocando Where antes da materialização.',
          'Mantenha projeção e paginação também antes de ToList/ToListAsync.'
        ],
        safeAutoFix: false,
        confidence: 0.9
      })
    ];
  }
};
