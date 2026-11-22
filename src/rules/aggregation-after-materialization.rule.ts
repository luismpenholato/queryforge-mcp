import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, looksLikeEfQuery } from './rule-helpers.js';
import { findAllPatternMatches } from './support/pattern-match.js';

const PATTERN =
  /\.(?:ToList(?:Async)?|AsEnumerable)\s*\([^)]*\)[\s\S]{0,240}?\.(?:Sum|Average|Count|Min|Max|Aggregate)\s*\(/;

export const aggregationAfterMaterializationRule: QueryRule = {
  code: 'AGGREGATION_AFTER_MATERIALIZATION',

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
        code: 'AGGREGATION_AFTER_MATERIALIZATION',
        title: 'Aggregation after materialization',
        severity: 'high',
        category: 'aggregation',
        message:
          'Aggregation (Sum/Average/Count/Min/Max) appears after ToList/AsEnumerable, which forces in-memory computation.',
        whyItMatters:
          'Materializing first loads every matching row into memory before aggregating, increasing latency and memory pressure.',
        suggestion: 'Push the aggregation into the IQueryable/SQL query before materialization.',
        rewritePlan: [
          'Call Sum/Average/Count/Min/Max on the IQueryable before ToList.',
          'If multiple aggregates are needed, project them in one server-side query.',
          'Keep AsEnumerable only when provider translation cannot express the operation.'
        ],
        safeAutoFix: false,
        confidence: 0.87,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'aggregate-before-materialization',
            'Aggregate on the query before materializing rows'
          )
        ]
      })
    ];
  }
};
