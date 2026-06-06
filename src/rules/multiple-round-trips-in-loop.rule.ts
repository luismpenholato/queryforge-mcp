import { QueryRule } from '../domain/query-rule.js';
import { countQueryTerminalsInLoops, createSmell } from './rule-helpers.js';

export const multipleRoundTripsInLoopRule: QueryRule = {
  code: 'MULTIPLE_ROUND_TRIPS_IN_LOOP',

  analyze(request) {
    if (countQueryTerminalsInLoops(request.code) < 2) {
      return [];
    }

    return [
      createSmell({
        code: 'MULTIPLE_ROUND_TRIPS_IN_LOOP',
        title: 'Múltiplos round-trips no mesmo loop',
        severity: 'high',
        category: 'round-trips',
        message: 'Multiple database queries inside the same loop can create excessive round-trips.',
        whyItMatters:
          'Each query inside a loop iteration multiplies database latency and connection pressure.',
        suggestion: 'Batch the required data before the loop and reuse in-memory lookups.',
        rewritePlan: [
          'Identify all queries executed inside the loop body.',
          'Load required related data in one or few batched queries before the loop.',
          'Use dictionaries or lookups keyed by id inside the loop.'
        ],
        safeAutoFix: false,
        confidence: 0.8
      })
    ];
  }
};
