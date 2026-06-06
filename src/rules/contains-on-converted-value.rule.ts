import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';

const CONTAINS_ON_CONVERTED_PATTERN = /\.ToString\s*\(\s*\)[\s\S]*?\.Contains\s*\(/;

export const containsOnConvertedValueRule: QueryRule = {
  code: 'CONTAINS_ON_CONVERTED_VALUE',

  analyze(request) {
    if (!hasWhereClause(request.code, CONTAINS_ON_CONVERTED_PATTERN)) {
      return [];
    }

    return [
      createSmell({
        code: 'CONTAINS_ON_CONVERTED_VALUE',
        title: 'Contains sobre valor convertido',
        severity: 'high',
        category: 'sargability',
        message: 'A query usa Contains após ToString() em coluna dentro do Where.',
        whyItMatters:
          'Contains sobre valor convertido costuma virar LIKE com wildcard e CAST/CONVERT, geralmente não sargável.',
        suggestion:
          'Evite busca textual sobre valores convertidos. Use comparação tipada ou campo de busca dedicado.',
        rewritePlan: [
          'Remova ToString().Contains do filtro.',
          'Defina estratégia de busca no tipo original ou campo normalizado.',
          'Valide o SQL gerado pelo provider antes de aplicar em produção.'
        ],
        safeAutoFix: false,
        confidence: 0.92
      })
    ];
  }
};
