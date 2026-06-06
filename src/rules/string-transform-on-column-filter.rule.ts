import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';

const STRING_TRANSFORM_PATTERN = /\.(ToLower|ToUpper|Trim|Substring)\s*\(/;

export const stringTransformOnColumnFilterRule: QueryRule = {
  code: 'STRING_TRANSFORM_ON_COLUMN_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, STRING_TRANSFORM_PATTERN)) {
      return [];
    }

    return [
      createSmell({
        code: 'STRING_TRANSFORM_ON_COLUMN_FILTER',
        title: 'Transformação de string em coluna no filtro',
        severity: 'high',
        category: 'sargability',
        message:
          'A query aplica ToLower, ToUpper, Trim ou Substring em coluna dentro do Where.',
        whyItMatters:
          'Funções em coluna textual costumam gerar SQL não sargável e impedem uso eficiente de índice.',
        suggestion:
          'Prefira colunas normalizadas, collation case-insensitive, colunas computadas persistidas ou estratégia indexada específica do provider.',
        rewritePlan: [
          'Identifique a transformação aplicada na coluna.',
          'Mova normalização para escrita (coluna persistida) ou use collation do banco.',
          'Remova transformação do predicado Where.'
        ],
        safeAutoFix: false,
        confidence: 0.87
      })
    ];
  }
};
