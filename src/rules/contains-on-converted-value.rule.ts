import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';
import { findWherePatternMatches } from './support/where-range.js';

const CONTAINS_ON_CONVERTED_PATTERN = /\.ToString\s*\(\s*\)[\s\S]*?\.Contains\s*\([^)]*\)/;

export const containsOnConvertedValueRule: QueryRule = {
  code: 'CONTAINS_ON_CONVERTED_VALUE',

  analyze(request) {
    if (!hasWhereClause(request.code, /\.ToString\s*\(\s*\)[\s\S]*?\.Contains\s*\(/)) {
      return [];
    }

    const matches = findWherePatternMatches(request.code, CONTAINS_ON_CONVERTED_PATTERN);

    return matches.map((match) =>
      createSmell({
        code: 'CONTAINS_ON_CONVERTED_VALUE',
        title: 'Contains on converted value',
        severity: 'high',
        category: 'sargability',
        message: 'The query uses Contains after ToString() on a column inside Where.',
        whyItMatters:
          'Contains on converted values often becomes LIKE with wildcards and CAST/CONVERT, which is usually not sargable.',
        suggestion:
          'Avoid text search on converted values. Use typed comparison or a dedicated search field.',
        rewritePlan: [
          'Remove ToString().Contains from the filter.',
          'Define a search strategy on the original type or a normalized field.',
          'Validate generated SQL with the provider before production use.'
        ],
        safeAutoFix: false,
        confidence: 0.92,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'remove-contains-on-converted-value',
            'Remove Contains on converted value and use a typed or normalized search strategy'
          )
        ]
      })
    );
  }
};
