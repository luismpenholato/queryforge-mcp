import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasLargeTake, parseTakeValue } from './rule-helpers.js';

export const largeTakeRule: QueryRule = {
  code: 'LARGE_TAKE',

  analyze(request) {
    if (!hasLargeTake(request.code)) {
      return [];
    }

    const takeValue = parseTakeValue(request.code);

    return [
      createSmell({
        code: 'LARGE_TAKE',
        title: 'Take com volume alto',
        severity: 'medium',
        category: 'pagination',
        message: `A query usa Take(${takeValue}) com valor alto (>= 10000).`,
        whyItMatters:
          'Volumes altos aumentam pressão de memória, IO e tempo de resposta mesmo com filtro eficiente.',
        suggestion: 'Revise tamanho de página, estratégia de batching e uso de memória.',
        rewritePlan: [
          'Reduza o Take para um tamanho de página seguro.',
          'Considere paginação incremental ou streaming quando aplicável.',
          'Monitore memória e latência em ambiente representativo.'
        ],
        safeAutoFix: false,
        confidence: 0.85
      })
    ];
  }
};
