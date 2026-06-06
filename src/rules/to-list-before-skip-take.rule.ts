import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';

const PATTERN = /\.(ToList|ToListAsync)\s*\(\s*\)[\s\S]*\.(Skip|Take)\s*\(/;

export const toListBeforeSkipTakeRule: QueryRule = {
  code: 'TO_LIST_BEFORE_SKIP_TAKE',

  analyze(request) {
    if (!PATTERN.test(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'TO_LIST_BEFORE_SKIP_TAKE',
        title: 'Materialização antes da paginação',
        severity: 'high',
        category: 'materialization',
        message: 'A query chama ToList/ToListAsync antes de Skip/Take.',
        whyItMatters:
          'Paginar em memória carrega o conjunto inteiro do banco antes de limitar resultados.',
        suggestion: 'Aplique paginação no banco antes da materialização.',
        rewritePlan: [
          'Mova Skip/Take para antes de ToList/ToListAsync.',
          'Garanta OrderBy estável antes da paginação.'
        ],
        safeAutoFix: false,
        confidence: 0.92
      })
    ];
  }
};
