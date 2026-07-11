import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, extractSelectBodies } from './rule-helpers.js';
import { findFirstPatternMatch } from './support/pattern-match.js';

const CORRELATED_SUBQUERY_PATTERN =
  /_context\.\w+\.(?:Count|Any|Average|Sum)\s*\([^)]*==[^)]*\)/;

export const correlatedSubqueryInProjectionRule: QueryRule = {
  code: 'CORRELATED_SUBQUERY_IN_PROJECTION',

  analyze(request) {
    const code = request.code;
    const smells = [];

    for (const body of extractSelectBodies(code)) {
      const bodyMatch = findFirstPatternMatch(body, CORRELATED_SUBQUERY_PATTERN);

      if (!bodyMatch) {
        continue;
      }

      const selectIndex = code.indexOf(body);
      const range = {
        start: selectIndex + bodyMatch.range.start,
        end: selectIndex + bodyMatch.range.end
      };

      smells.push(
        createSmell({
          code: 'CORRELATED_SUBQUERY_IN_PROJECTION',
          title: 'Correlated subquery in projection',
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
          confidence: 0.75,
          range,
          fixes: [
            createReviewRequiredFix(
              'pre-aggregate-projection',
              'Pre-aggregate correlated data before projecting per row'
            )
          ]
        })
      );
    }

    return smells;
  }
};
