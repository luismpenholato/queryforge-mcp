import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasCustomMethodInWhere } from './rule-helpers.js';
import { findWherePatternMatches } from './support/where-range.js';

const CUSTOM_METHOD_PATTERN = /\b([A-Z][A-Za-z0-9_]*)\s*\(/;

export const clientSideMethodInWhereRule: QueryRule = {
  code: 'CLIENT_SIDE_METHOD_IN_WHERE',

  analyze(request) {
    if (!hasCustomMethodInWhere(request.code)) {
      return [];
    }

    const matches = findWherePatternMatches(request.code, CUSTOM_METHOD_PATTERN);

    return [
      createSmell({
        code: 'CLIENT_SIDE_METHOD_IN_WHERE',
        title: 'Custom method inside Where',
        severity: 'medium',
        category: 'translation',
        message:
          'The query calls a custom method inside Where, which may not translate to SQL.',
        whyItMatters:
          'Custom methods in predicates often force client-side evaluation or fail translation depending on provider and version.',
        suggestion:
          'Ensure the method is translatable to SQL. Prefer expression-based filters or database equivalents.',
        rewritePlan: [
          'Verify whether the method has SQL translation supported by the provider.',
          'Replace with an inline translatable expression or database logic.',
          'Validate generated SQL with EF Core logging.'
        ],
        safeAutoFix: false,
        confidence: 0.78,
        range: matches[0]?.range
      })
    ];
  }
};
