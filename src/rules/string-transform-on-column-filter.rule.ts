import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';
import { findWherePatternMatches } from './support/where-range.js';

const STRING_TRANSFORM_PATTERN = /\.(ToLower|ToUpper|Trim|Substring)\s*\([^)]*\)/;

export const stringTransformOnColumnFilterRule: QueryRule = {
  code: 'STRING_TRANSFORM_ON_COLUMN_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, /\.(ToLower|ToUpper|Trim|Substring)\s*\(/)) {
      return [];
    }

    const matches = findWherePatternMatches(request.code, STRING_TRANSFORM_PATTERN);

    return matches.map((match) =>
      createSmell({
        code: 'STRING_TRANSFORM_ON_COLUMN_FILTER',
        title: 'String transform on column in filter',
        severity: 'high',
        category: 'sargability',
        message: 'The query applies ToLower, ToUpper, Trim or Substring on a column inside Where.',
        whyItMatters:
          'Functions on text columns often produce non-sargable SQL and prevent efficient index usage.',
        suggestion:
          'Prefer normalized columns, case-insensitive collation, persisted computed columns, or a provider-specific indexed strategy.',
        rewritePlan: [
          'Identify the transform applied to the column.',
          'Move normalization to write time (persisted column) or use database collation.',
          'Remove the transform from the Where predicate.'
        ],
        safeAutoFix: false,
        confidence: 0.87,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'remove-string-transform-from-filter',
            'Remove string transform from the filter and use a normalized column or collation'
          )
        ]
      })
    );
  }
};
