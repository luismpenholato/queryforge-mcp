import { QueryRule } from '../domain/query-rule.js';
import { countIncludeCalls, createSmell } from './rule-helpers.js';

export const multipleCollectionIncludesRule: QueryRule = {
  code: 'MULTIPLE_COLLECTION_INCLUDES',

  analyze(request) {
    if (countIncludeCalls(request.code) < 2) {
      return [];
    }

    return [
      createSmell({
        code: 'MULTIPLE_COLLECTION_INCLUDES',
        title: 'Múltiplos Include/ThenInclude',
        severity: 'medium',
        category: 'projection',
        message:
          'A query usa dois ou mais Include/ThenInclude, o que pode gerar joins grandes ou explosão cartesiana.',
        whyItMatters:
          'Múltiplas coleções incluídas na mesma query aumentam volume de dados e complexidade do SQL gerado.',
        suggestion:
          'Considere projeção, Include filtrado ou AsSplitQuery quando apropriado.',
        rewritePlan: [
          'Avalie se todos os includes são necessários na mesma consulta.',
          'Prefira Select para DTO quando possível.',
          'Teste AsSplitQuery com cuidado em cenários com múltiplas coleções.'
        ],
        safeAutoFix: false,
        confidence: 0.8
      })
    ];
  }
};
