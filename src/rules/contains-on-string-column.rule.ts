import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';

const STRING_COLUMN_CONTAINS_PATTERN =
  /[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)+(?:\.(?:ToLower|ToUpper|Trim|Substring)\s*\(\s*\))?\.Contains\s*\(/;

export const containsOnStringColumnRule: QueryRule = {
  code: 'CONTAINS_ON_STRING_COLUMN',

  analyze(request) {
    if (!hasWhereClause(request.code, STRING_COLUMN_CONTAINS_PATTERN)) {
      return [];
    }

    return [
      createSmell({
        code: 'CONTAINS_ON_STRING_COLUMN',
        title: 'Contains em coluna textual',
        severity: 'medium',
        category: 'sargability',
        message: 'A query usa Contains em propriedade textual dentro do Where.',
        whyItMatters:
          'Contains pode ser traduzido para LIKE com wildcard à esquerda e direita, limitando uso de índice.',
        suggestion:
          'Para busca por prefixo, prefira StartsWith. Para busca geral, considere full-text search ou índice dedicado.',
        rewritePlan: [
          'Confirme se a busca é por prefixo ou substring.',
          'Troque por StartsWith quando for prefixo.',
          'Avalie full-text search para busca ampla em texto.'
        ],
        safeAutoFix: false,
        confidence: 0.8
      })
    ];
  }
};
