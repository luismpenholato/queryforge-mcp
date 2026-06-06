import { QueryRule } from '../domain/query-rule.js';
import { createSmell, extractWhereBodies, hasDuplicatedPredicate } from './rule-helpers.js';

export const duplicatedPredicateRule: QueryRule = {
  code: 'DUPLICATED_PREDICATE',

  analyze(request) {
    const hasDuplicate = extractWhereBodies(request.code).some((body) =>
      hasDuplicatedPredicate(body)
    );

    if (!hasDuplicate) {
      return [];
    }

    return [
      createSmell({
        code: 'DUPLICATED_PREDICATE',
        title: 'Predicado duplicado no filtro',
        severity: 'low',
        category: 'redundant-filter',
        message: 'Duplicated predicate found inside the same filter.',
        whyItMatters:
          'Repeated conditions add noise and may hide more important filter issues during review.',
        suggestion:
          'Remove the duplicated condition to reduce noise and avoid misleading query complexity.',
        rewritePlan: [
          'Identify repeated && conditions inside the same Where.',
          'Keep a single copy of each unique predicate.'
        ],
        safeAutoFix: true,
        confidence: 0.72
      })
    ];
  }
};
