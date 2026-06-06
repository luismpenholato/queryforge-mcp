import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';

const MULTIPLE_ORDER_BY_PATTERN =
  /\.OrderBy(?:Descending)?\s*\([\s\S]*?\.OrderBy(?:Descending)?\s*\(/;

export const multipleOrderByRule: QueryRule = {
  code: 'MULTIPLE_ORDER_BY',

  analyze(request) {
    if (!MULTIPLE_ORDER_BY_PATTERN.test(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'MULTIPLE_ORDER_BY',
        title: 'Múltiplos OrderBy na mesma chain',
        severity: 'medium',
        category: 'ordering',
        message:
          'A query usa OrderBy/OrderByDescending mais de uma vez; o segundo sobrescreve o anterior.',
        whyItMatters:
          'Um segundo OrderBy descarta a ordenação anterior em vez de compor critérios secundários.',
        suggestion:
          'Use ThenBy/ThenByDescending para ordenação secundária. Um segundo OrderBy sobrescreve o anterior.',
        rewritePlan: [
          'Identifique o primeiro OrderBy da chain.',
          'Substitua OrderBy subsequentes por ThenBy/ThenByDescending.',
          'Adicione coluna única (ex.: Id) como critério final para estabilidade.'
        ],
        safeAutoFix: false,
        confidence: 0.86
      })
    ];
  }
};
