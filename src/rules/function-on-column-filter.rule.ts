import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';

const DATE_MEMBER_PATTERN = /\.(Year|Month|Day|Date|Hour|Minute|Second)\b/;

export const functionOnColumnFilterRule: QueryRule = {
  code: 'FUNCTION_ON_COLUMN_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, DATE_MEMBER_PATTERN)) {
      return [];
    }

    return [
      createSmell({
        code: 'FUNCTION_ON_COLUMN_FILTER',
        title: 'Função aplicada em coluna no filtro',
        severity: 'high',
        category: 'sargability',
        message:
          'A query usa membros de DateTime (Year, Month, Day, Date, Hour, etc.) dentro do Where.',
        whyItMatters:
          'Isso pode ser traduzido para funções SQL na coluna (ex.: DATEPART), reduzindo a chance de uso eficiente de índice.',
        suggestion:
          'Use filtros de intervalo: OrderedAt >= startDate && OrderedAt < endDate',
        rewritePlan: [
          'Identifique o membro de data usado no filtro (Year, Month, Day, etc.).',
          'Calcule startDate e endDate no código da aplicação.',
          'Substitua a comparação por intervalo na coluna original sem função.'
        ],
        safeAutoFix: false,
        confidence: 0.88
      })
    ];
  }
};
