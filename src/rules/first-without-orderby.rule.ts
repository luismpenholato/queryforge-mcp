import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';
import { findFirstMethodCallRange } from './support/where-range.js';

export const firstWithoutOrderByRule: QueryRule = {
  code: 'FIRST_WITHOUT_ORDER_BY',

  analyze(request) {
    const code = request.code;

    const hasFirst = /\.(?:First|FirstOrDefault|FirstAsync|FirstOrDefaultAsync)\s*\(/.test(code);
    const hasOrderBy = /\.OrderBy\s*\(|\.OrderByDescending\s*\(/.test(code);

    if (!hasFirst || hasOrderBy) {
      return [];
    }

    const range = findFirstMethodCallRange(code, [
      'First',
      'FirstOrDefault',
      'FirstAsync',
      'FirstOrDefaultAsync'
    ]);

    return [
      createSmell({
        code: 'FIRST_WITHOUT_ORDER_BY',
        title: 'First without explicit ordering',
        severity: 'low',
        message:
          'The query uses First/FirstOrDefault without OrderBy. If order matters, the result may be non-deterministic.',
        suggestion:
          'Add OrderBy/OrderByDescending when business rules depend on a specific order.',
        confidence: 0.65,
        range
      })
    ];
  }
};
