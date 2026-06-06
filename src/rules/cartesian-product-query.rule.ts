import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';

const MULTIPLE_FROM_PATTERN = /\bfrom\s+\w+\s+in\s+[\s\S]*?\bfrom\s+\w+\s+in\s+/i;
const CHAINED_SELECT_MANY_PATTERN =
  /\.SelectMany\s*\([\s\S]*?\)\s*[\s\S]*?\.SelectMany\s*\(/;

export const cartesianProductQueryRule: QueryRule = {
  code: 'CARTESIAN_PRODUCT_QUERY',

  analyze(request) {
    const code = request.code;
    const hasCartesian =
      MULTIPLE_FROM_PATTERN.test(code) || CHAINED_SELECT_MANY_PATTERN.test(code);

    if (!hasCartesian) {
      return [];
    }

    return [
      createSmell({
        code: 'CARTESIAN_PRODUCT_QUERY',
        title: 'Possível produto cartesiano',
        severity: 'high',
        category: 'cardinality',
        message: 'Multiple from/SelectMany clauses may create a cartesian product.',
        whyItMatters:
          'Cartesian products can multiply row counts dramatically and cause large result sets, high CPU, memory, IO and network usage.',
        suggestion:
          'Use explicit joins, navigations, or restrictive predicates to relate the sources.',
        rewritePlan: [
          'Relate sources with explicit join conditions or navigation properties.',
          'Avoid unrelated cross products unless intentionally required.',
          'Validate row count impact before materializing large cartesian results.'
        ],
        safeAutoFix: false,
        confidence: 0.78
      })
    ];
  }
};
