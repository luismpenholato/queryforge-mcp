import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, hasQueryInLoop, QUERY_TERMINAL_PATTERN } from './rule-helpers.js';
import { findChainSegmentRange } from './support/where-range.js';

export const nPlusOneQueryInLoopRule: QueryRule = {
  code: 'N_PLUS_ONE_QUERY_IN_LOOP',

  analyze(request) {
    if (!hasQueryInLoop(request.code)) {
      return [];
    }

    const range = findChainSegmentRange(request.code, QUERY_TERMINAL_PATTERN);

    return [
      createSmell({
        code: 'N_PLUS_ONE_QUERY_IN_LOOP',
        title: 'Query inside loop (N+1)',
        severity: 'high',
        category: 'round-trips',
        message: 'Query execution inside a loop may create an N+1 query pattern.',
        whyItMatters:
          'Each iteration can trigger a separate database round-trip, which scales poorly as the collection grows.',
        suggestion:
          'Load related data in a single query, batch by ids, use projection, join/grouping, or pre-fetch the required data before the loop.',
        rewritePlan: [
          'Collect the required ids before the loop.',
          'Query related data once using Contains over the id list.',
          'Group the result in memory after materialization.',
          'Iterate over the preloaded dictionary/grouping instead of querying per item.'
        ],
        safeAutoFix: false,
        confidence: 0.82,
        range,
        fixes: [
          createReviewRequiredFix(
            'batch-queries-outside-loop',
            'Batch required data before the loop instead of querying per iteration'
          )
        ]
      })
    ];
  }
};
