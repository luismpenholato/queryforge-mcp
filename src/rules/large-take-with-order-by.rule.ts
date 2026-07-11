import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasLargeTake } from './rule-helpers.js';
import { findFirstMethodCallRange } from './support/where-range.js';

export const largeTakeWithOrderByRule: QueryRule = {
  code: 'LARGE_TAKE_WITH_ORDER_BY',

  analyze(request) {
    const code = request.code;
    const hasOrderBy = /\.OrderBy(?:Descending)?\s*\(/.test(code);

    if (!hasOrderBy || !hasLargeTake(code)) {
      return [];
    }

    const range = findFirstMethodCallRange(code, ['Take']);

    return [
      createSmell({
        code: 'LARGE_TAKE_WITH_ORDER_BY',
        title: 'Large Take with ordering',
        severity: 'medium',
        category: 'pagination',
        message: 'The query combines OrderBy with Take >= 10000.',
        whyItMatters:
          'Large ordered result sets may require significant sorting, extra IO and high memory usage.',
        suggestion:
          'Verify index strategy for OrderBy columns and reduce the returned volume.',
        rewritePlan: [
          'Confirm an index covering OrderBy columns.',
          'Reduce Take or paginate in smaller batches.',
          'Evaluate minimal projection before ordering.'
        ],
        safeAutoFix: false,
        confidence: 0.84,
        range
      })
    ];
  }
};
