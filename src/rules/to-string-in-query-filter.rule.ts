import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';
import { findWherePatternMatches } from './support/where-range.js';

const TO_STRING_PATTERN = /\.ToString\s*\([^)]*\)/;

export const toStringInQueryFilterRule: QueryRule = {
  code: 'TO_STRING_IN_QUERY_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, /\.ToString\s*\(/)) {
      return [];
    }

    const matches = findWherePatternMatches(request.code, TO_STRING_PATTERN);

    return matches.map((match) =>
      createSmell({
        code: 'TO_STRING_IN_QUERY_FILTER',
        title: 'ToString() in query filter',
        severity: 'high',
        category: 'sargability',
        message: 'The query calls ToString() inside Where.',
        whyItMatters:
          'Converting database columns to string in filters usually prevents index usage and forces runtime conversion.',
        suggestion:
          'Avoid converting columns to string in filters. Prefer typed comparisons, indexed computed columns, or a dedicated search strategy.',
        rewritePlan: [
          'Remove ToString() from the filter.',
          'Use direct comparison on the original column type.',
          'If text search is required, evaluate a normalized field or full-text search.'
        ],
        safeAutoFix: false,
        confidence: 0.9,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'remove-tostring-from-filter',
            'Remove ToString() from the filter and use a typed comparison'
          )
        ]
      })
    );
  }
};
