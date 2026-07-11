import { QueryRule } from '../domain/query-rule.js';
import { createSmell, extractWhereBodies, hasDuplicatedPredicate } from './rule-helpers.js';
import { findWherePatternMatches } from './support/where-range.js';

const DUPLICATED_PREDICATE_PATTERN = /&&[\s\S]*?&&/;

export const duplicatedPredicateRule: QueryRule = {
  code: 'DUPLICATED_PREDICATE',

  analyze(request) {
    const code = request.code;
    const smells = [];

    for (const body of extractWhereBodies(code)) {
      if (!hasDuplicatedPredicate(body)) {
        continue;
      }

      const predicate = body.includes('=>')
        ? body.slice(body.indexOf('=>') + 2).trim()
        : body.trim();

      const parts = predicate
        .split('&&')
        .map((part) => part.trim().replace(/\s+/g, ' '))
        .filter((part) => part.length > 0);

      const seen = new Set<string>();

      for (const part of parts) {
        if (seen.has(part)) {
          const bodyStart = code.indexOf(body);
          const partIndex = body.indexOf(part);
          const range =
            bodyStart >= 0 && partIndex >= 0
              ? { start: bodyStart + partIndex, end: bodyStart + partIndex + part.length }
              : undefined;

          smells.push(
            createSmell({
              code: 'DUPLICATED_PREDICATE',
              title: 'Duplicated predicate in filter',
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
              confidence: 0.72,
              range
            })
          );
        } else {
          seen.add(part);
        }
      }
    }

    if (smells.length > 0) {
      return smells;
    }

    if (extractWhereBodies(code).some((body) => hasDuplicatedPredicate(body))) {
      const range = findWherePatternMatches(code, DUPLICATED_PREDICATE_PATTERN)[0]?.range;

      return [
        createSmell({
          code: 'DUPLICATED_PREDICATE',
          title: 'Duplicated predicate in filter',
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
          confidence: 0.72,
          range
        })
      ];
    }

    return [];
  }
};
