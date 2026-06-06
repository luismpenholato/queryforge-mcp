import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';

const TO_STRING_PATTERN = /\.ToString\s*\(/;

export const toStringInQueryFilterRule: QueryRule = {
  code: 'TO_STRING_IN_QUERY_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, TO_STRING_PATTERN)) {
      return [];
    }

    return [
      createSmell({
        code: 'TO_STRING_IN_QUERY_FILTER',
        title: 'ToString() em filtro de query',
        severity: 'high',
        category: 'sargability',
        message: 'A query chama ToString() dentro do Where.',
        whyItMatters:
          'Converter colunas do banco para string no filtro geralmente impede uso de índice e força conversão em runtime.',
        suggestion:
          'Evite converter colunas para string em filtros. Prefira comparações tipadas, colunas computadas indexadas ou estratégia de busca dedicada.',
        rewritePlan: [
          'Remova ToString() do filtro.',
          'Use comparação direta no tipo original da coluna.',
          'Se busca textual for necessária, avalie campo normalizado ou full-text search.'
        ],
        safeAutoFix: false,
        confidence: 0.9
      })
    ];
  }
};
