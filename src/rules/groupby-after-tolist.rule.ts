import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, looksLikeEfQuery } from './rule-helpers.js';
import { findAllPatternMatches } from './support/pattern-match.js';

const PATTERN =
  /\.(?:ToList(?:Async)?|AsEnumerable)\s*\([^)]*\)[\s\S]{0,240}?\.(?:GroupBy)\s*\(/;

export const groupByAfterToListRule: QueryRule = {
  code: 'GROUPBY_AFTER_TOLIST',

  analyze(request) {
    if (!looksLikeEfQuery(request.code) && request.provider !== 'linq' && request.provider !== 'ef-core' && request.provider !== 'ef6') {
      return [];
    }

    const match = findAllPatternMatches(request.code, PATTERN)[0];
    if (!match) {
      return [];
    }

    return [
      createSmell({
        code: 'GROUPBY_AFTER_TOLIST',
        title: 'GroupBy after materialization',
        severity: 'medium',
        category: 'aggregation',
        message: 'GroupBy appears after ToList/AsEnumerable, so grouping happens in memory.',
        whyItMatters:
          'Grouping after materialization pulls the full result set into memory even when only grouped aggregates are needed.',
        suggestion: 'Prefer server-side GroupBy/aggregation when the provider can translate it.',
        rewritePlan: [
          'Move GroupBy before materialization when EF can translate the expression.',
          'Project aggregates in SQL instead of grouping wide entities in memory.',
          'If client grouping is intentional, document why and constrain the result size.'
        ],
        safeAutoFix: false,
        confidence: 0.83,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'groupby-before-materialization',
            'Group on the query before materializing rows'
          )
        ]
      })
    ];
  }
};
