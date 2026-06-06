import { QueryRule } from '../domain/query-rule.js';
import { createSmell, extractSelectBodies } from './rule-helpers.js';

const CORRELATED_CONTEXT_PATTERN =
  /_context\.\w+\.(?:Count|Any|Average|Sum)\s*\([^)]*==/;
const CORRELATED_NAVIGATION_PATTERN =
  /\.\w+\.(?:Count|Any|Average|Sum)\s*\(/;
const CORRELATED_WHERE_COUNT_PATTERN =
  /_context\.\w+\.Where\s*\([^)]*==[^)]*\)\s*\.Count\s*\(/;

export const correlatedSubqueryInProjectionRule: QueryRule = {
  code: 'CORRELATED_SUBQUERY_IN_PROJECTION',

  analyze(request) {
    const hasCorrelatedSubquery = extractSelectBodies(request.code).some(
      (body) =>
        CORRELATED_CONTEXT_PATTERN.test(body) ||
        CORRELATED_WHERE_COUNT_PATTERN.test(body) ||
        (CORRELATED_NAVIGATION_PATTERN.test(body) &&
          /(?:Count|Any|Average|Sum)\s*\(/.test(body))
    );

    if (!hasCorrelatedSubquery) {
      return [];
    }

    return [
      createSmell({
        code: 'CORRELATED_SUBQUERY_IN_PROJECTION',
        title: 'Subquery correlacionada na projeção',
        severity: 'medium',
        category: 'subquery',
        message:
          'Correlated subqueries inside projection can be executed or translated in expensive ways depending on provider and query shape.',
        whyItMatters:
          'Per-row aggregates in Select may become correlated subqueries or repeated scans at runtime.',
        suggestion:
          'Consider grouping, pre-aggregating, joining aggregated results, or projecting from a grouped query.',
        rewritePlan: [
          'Move aggregation to a grouped query or join pre-aggregated results.',
          'Avoid per-row Count/Sum/Average against another DbSet inside Select.',
          'Validate generated SQL and execution plan for repeated subqueries.'
        ],
        safeAutoFix: false,
        confidence: 0.75
      })
    ];
  }
};
