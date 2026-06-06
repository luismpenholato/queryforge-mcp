import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasLargeTake } from './rule-helpers.js';

export const largeTakeWithOrderByRule: QueryRule = {
  code: 'LARGE_TAKE_WITH_ORDER_BY',

  analyze(request) {
    const code = request.code;
    const hasOrderBy = /\.OrderBy(?:Descending)?\s*\(/.test(code);

    if (!hasOrderBy || !hasLargeTake(code)) {
      return [];
    }

    return [
      createSmell({
        code: 'LARGE_TAKE_WITH_ORDER_BY',
        title: 'Take alto com ordenação',
        severity: 'medium',
        category: 'pagination',
        message: 'A query combina OrderBy com Take >= 10000.',
        whyItMatters:
          'Conjuntos ordenados grandes podem exigir sort significativo, IO extra e alto uso de memória.',
        suggestion:
          'Verifique estratégia de índice para as colunas de ordenação e reduza o volume retornado.',
        rewritePlan: [
          'Confirme índice cobrindo colunas do OrderBy.',
          'Reduza Take ou pagine em lotes menores.',
          'Avalie projeção mínima antes da ordenação.'
        ],
        safeAutoFix: false,
        confidence: 0.84
      })
    ];
  }
};
