import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, looksLikeDapperQuery } from './rule-helpers.js';
import { findAllPatternMatches } from './support/pattern-match.js';

const SELECT_STAR_PATTERN = /\bSELECT\s+\*(?=\s|,|$)/i;

export const dapperSelectStarRule: QueryRule = {
  code: 'DAPPER_SELECT_STAR',

  analyze(request) {
    if (!looksLikeDapperQuery(request.code) && request.provider !== 'dapper') {
      return [];
    }

    const match = findAllPatternMatches(request.code, SELECT_STAR_PATTERN)[0];
    if (!match) {
      return [];
    }

    return [
      createSmell({
        code: 'DAPPER_SELECT_STAR',
        title: 'Dapper SELECT *',
        severity: 'medium',
        category: 'projection',
        message: 'The SQL appears to use SELECT *, which may load unnecessary columns.',
        whyItMatters:
          'Selecting all columns increases IO, memory use and makes queries more fragile when the table shape changes.',
        suggestion: 'Project only the columns required by the DTO or consumer.',
        rewritePlan: [
          'Replace SELECT * with an explicit column list matching the mapped type.',
          'Keep the list aligned with the Dapper result type.',
          'Revisit indexes after narrowing selected columns.'
        ],
        safeAutoFix: false,
        confidence: 0.88,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'project-required-columns',
            'Replace SELECT * with an explicit column list'
          )
        ]
      })
    ];
  }
};
