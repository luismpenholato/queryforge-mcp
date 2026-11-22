import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, DAPPER_CALL_PATTERN, hasDapperCallInLoop } from './rule-helpers.js';
import { findAllPatternMatches } from './support/pattern-match.js';

export const dapperQueryInLoopRule: QueryRule = {
  code: 'DAPPER_QUERY_IN_LOOP',

  analyze(request) {
    if (!hasDapperCallInLoop(request.code)) {
      return [];
    }

    const match = findAllPatternMatches(request.code, DAPPER_CALL_PATTERN)[0];

    return [
      createSmell({
        code: 'DAPPER_QUERY_IN_LOOP',
        title: 'Dapper call inside loop',
        severity: 'high',
        category: 'round-trips',
        message:
          'A Dapper Query/Execute/QueryMultiple call inside a loop may create an N+1 round-trip pattern.',
        whyItMatters:
          'Each iteration can open another database round-trip, which scales poorly as the input collection grows.',
        suggestion: 'Batch parameters and execute one query, or load required rows before the loop.',
        rewritePlan: [
          'Collect ids or keys before the loop.',
          'Issue one parameterized query using IN / ANY / JOIN against the batch.',
          'Index results in memory and reuse them inside the loop.'
        ],
        safeAutoFix: false,
        confidence: 0.86,
        range: match?.range,
        fixes: [
          createReviewRequiredFix(
            'batch-dapper-queries',
            'Batch Dapper work outside the loop'
          )
        ]
      })
    ];
  }
};
