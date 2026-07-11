import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';
import { findFirstMethodCallRange } from './support/where-range.js';

export const paginationWithoutOrderByRule: QueryRule = {
  code: 'PAGINATION_WITHOUT_ORDER_BY',

  analyze(request) {
    const code = request.code;

    const hasPagination = /\.Skip\s*\(|\.Take\s*\(/.test(code);
    const hasOrderBy = /\.OrderBy\s*\(|\.OrderByDescending\s*\(|\.ThenBy\s*\(|\.ThenByDescending\s*\(/.test(code);

    if (!hasPagination || hasOrderBy) {
      return [];
    }

    const range =
      findFirstMethodCallRange(code, ['Skip', 'Take']) ??
      findFirstMethodCallRange(code, ['SkipAsync', 'TakeAsync']);

    return [
      createSmell({
        code: 'PAGINATION_WITHOUT_ORDER_BY',
        title: 'Pagination without explicit ordering',
        severity: 'high',
        message:
          'The query uses Skip/Take without OrderBy, which can produce unstable results between executions.',
        suggestion:
          'Add OrderBy before Skip/Take using a deterministic column such as Id or CreatedAt.',
        confidence: 0.9,
        range
      })
    ];
  }
};
