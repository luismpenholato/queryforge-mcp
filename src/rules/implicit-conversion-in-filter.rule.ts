import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';

const IMPLICIT_CONVERSION_PATTERN =
  /\.ToString\s*\(|Convert\.ToString\s*\(|Convert\.ToInt32\s*\(|int\.Parse\s*\(|long\.Parse\s*\(|decimal\.Parse\s*\(|Guid\.Parse\s*\(|DateTime\.Parse\s*\(/;

export const implicitConversionInFilterRule: QueryRule = {
  code: 'IMPLICIT_CONVERSION_IN_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, IMPLICIT_CONVERSION_PATTERN)) {
      return [];
    }

    return [
      createSmell({
        code: 'IMPLICIT_CONVERSION_IN_FILTER',
        title: 'Conversão implícita no filtro',
        severity: 'high',
        category: 'sargability',
        message:
          'Type conversion inside query filters can force conversions in SQL and prevent efficient index usage.',
        whyItMatters:
          'Parsing or converting column values inside predicates often blocks index seeks and adds runtime conversion cost.',
        suggestion:
          'Align model/database types and compare values using the same type. Avoid parsing/converting columns inside predicates.',
        rewritePlan: [
          'Store and compare values using the same type in model and database.',
          'Move parsing/conversion to application input validation before the query.',
          'Remove ToString/Parse/Convert calls from column predicates.'
        ],
        safeAutoFix: false,
        confidence: 0.82
      })
    ];
  }
};
