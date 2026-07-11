import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, hasWhereClause } from './rule-helpers.js';
import { findWherePatternMatches } from './support/where-range.js';

const DATE_MEMBER_ON_COLUMN_PATTERN =
  /[a-zA-Z_]\w*\.\w+\.(Year|Month|Day|Date|Hour|Minute|Second)\b/;

export const functionOnColumnFilterRule: QueryRule = {
  code: 'FUNCTION_ON_COLUMN_FILTER',

  analyze(request) {
    if (!hasWhereClause(request.code, DATE_MEMBER_ON_COLUMN_PATTERN)) {
      return [];
    }

    const matches = findWherePatternMatches(request.code, DATE_MEMBER_ON_COLUMN_PATTERN);

    return matches.map((match) =>
      createSmell({
        code: 'FUNCTION_ON_COLUMN_FILTER',
        title: 'Function applied to column in filter',
        severity: 'high',
        category: 'sargability',
        message: 'The query uses DateTime members (Year, Month, Day, Date, Hour, etc.) inside Where.',
        whyItMatters:
          'This may translate to SQL functions on the column (e.g. DATEPART), reducing the chance of efficient index usage.',
        suggestion: 'Use range filters: OrderedAt >= startDate && OrderedAt < endDate',
        rewritePlan: [
          'Identify the date member used in the filter (Year, Month, Day, etc.).',
          'Compute startDate and endDate in application code.',
          'Replace the comparison with a range on the original column without a function.'
        ],
        safeAutoFix: false,
        confidence: 0.88,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'replace-date-member-with-range',
            'Replace date member filter with a range on the original column'
          )
        ]
      })
    );
  }
};
