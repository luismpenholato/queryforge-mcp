import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';
import { findFirstMethodCallRange } from './support/where-range.js';

export const unnecessaryIncludeWithProjectionRule: QueryRule = {
  code: 'UNNECESSARY_INCLUDE_WITH_PROJECTION',

  analyze(request) {
    const code = request.code;

    const hasInclude = /\.Include\s*\(/.test(code);
    const hasProjection = /\.Select\s*\(/.test(code);

    if (!hasInclude || !hasProjection) {
      return [];
    }

    const range = findFirstMethodCallRange(code, ['Include']);

    return [
      createSmell({
        code: 'UNNECESSARY_INCLUDE_WITH_PROJECTION',
        title: 'Possibly unnecessary Include with projection',
        severity: 'medium',
        message:
          'The query uses Include together with Select. For DTO projections, Include is often unnecessary.',
        suggestion:
          'Check whether Include can be removed and required fields projected directly in Select.',
        confidence: 0.7,
        range
      })
    ];
  }
};
