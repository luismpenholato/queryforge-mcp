import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';
import { buildCountGreaterThanZeroSmellData } from './support/query-fixes.js';
import { findAllPatternMatches } from './support/pattern-match.js';

const COUNT_EXISTENCE_PATTERN =
  /\.(?<method>Count|CountAsync)\s*\([^)]*\)\s*(?:>|!=|>=)\s*(?:0|1)/;

export const countGreaterThanZeroRule: QueryRule = {
  code: 'COUNT_GREATER_THAN_ZERO',

  analyze(request) {
    const code = request.code;
    const matches = findAllPatternMatches(code, COUNT_EXISTENCE_PATTERN);

    if (matches.length === 0) {
      return [];
    }

    const safeOccurrences = buildCountGreaterThanZeroSmellData(code);

    return matches.map((match) => {
      const safeOccurrence = safeOccurrences.find(
        (occurrence) =>
          occurrence.range.start === match.range.start || occurrence.range.end === match.range.end
      );

      return createSmell({
        code: 'COUNT_GREATER_THAN_ZERO',
        title: 'Count used to check existence',
        severity: 'medium',
        message: 'The query appears to use Count/CountAsync to check whether records exist.',
        suggestion:
          'Replace with Any/AnyAsync when the goal is only to verify that at least one record exists.',
        confidence: 0.9,
        range: safeOccurrence?.range ?? match.range,
        fixes: safeOccurrence?.fixes,
        safeAutoFix: Boolean(safeOccurrence?.fixes?.length)
      });
    });
  }
};
