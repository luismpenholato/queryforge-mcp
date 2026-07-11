import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasLargeTake, parseTakeValue } from './rule-helpers.js';
import { findFirstMethodCallRange } from './support/where-range.js';

export const largeTakeRule: QueryRule = {
  code: 'LARGE_TAKE',

  analyze(request) {
    if (!hasLargeTake(request.code)) {
      return [];
    }

    const takeValue = parseTakeValue(request.code);
    const range = findFirstMethodCallRange(request.code, ['Take']);

    return [
      createSmell({
        code: 'LARGE_TAKE',
        title: 'Large Take value',
        severity: 'medium',
        category: 'pagination',
        message: `The query uses Take(${takeValue}) with a high value (>= 10000).`,
        whyItMatters:
          'Large result sets increase memory pressure, IO and response time even with an efficient filter.',
        suggestion: 'Review page size, batching strategy and memory usage.',
        rewritePlan: [
          'Reduce Take to a safe page size.',
          'Consider incremental pagination or streaming when applicable.',
          'Monitor memory and latency in a representative environment.'
        ],
        safeAutoFix: false,
        confidence: 0.85,
        range
      })
    ];
  }
};
