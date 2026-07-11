import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell } from './rule-helpers.js';
import { findChainSegmentRange } from './support/where-range.js';

const MULTIPLE_FROM_PATTERN = /\bfrom\s+\w+\s+in\s+[\s\S]*?\bfrom\s+\w+\s+in\s+/i;
const CHAINED_SELECT_MANY_PATTERN =
  /\.SelectMany\s*\([\s\S]*?\)\s*[\s\S]*?\.SelectMany\s*\(/;

export const cartesianProductQueryRule: QueryRule = {
  code: 'CARTESIAN_PRODUCT_QUERY',

  analyze(request) {
    const code = request.code;
    const hasMultipleFrom = MULTIPLE_FROM_PATTERN.test(code);
    const hasChainedSelectMany = CHAINED_SELECT_MANY_PATTERN.test(code);

    if (!hasMultipleFrom && !hasChainedSelectMany) {
      return [];
    }

    const range = hasChainedSelectMany
      ? findChainSegmentRange(code, /\.SelectMany\s*\([^)]*\)[\s\S]*?\.SelectMany\s*\([^)]*\)/)
      : findChainSegmentRange(code, /\bfrom\s+\w+\s+in\s+[\s\S]*?\bfrom\s+\w+\s+in\s+\w+/i);

    return [
      createSmell({
        code: 'CARTESIAN_PRODUCT_QUERY',
        title: 'Possible cartesian product',
        severity: 'high',
        category: 'cardinality',
        message: 'Multiple from/SelectMany clauses may create a cartesian product.',
        whyItMatters:
          'Cartesian products can multiply row counts dramatically and cause large result sets, high CPU, memory, IO and network usage.',
        suggestion: 'Use explicit joins, navigations, or restrictive predicates to relate the sources.',
        rewritePlan: [
          'Relate sources with explicit join conditions or navigation properties.',
          'Avoid unrelated cross products unless intentionally required.',
          'Validate row count impact before materializing large cartesian results.'
        ],
        safeAutoFix: false,
        confidence: 0.78,
        range,
        fixes: [
          createReviewRequiredFix(
            'relate-query-sources',
            'Relate query sources with explicit joins or restrictive predicates'
          )
        ]
      })
    ];
  }
};
