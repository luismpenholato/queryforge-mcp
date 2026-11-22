import { QueryRule } from '../domain/query-rule.js';
import { createReviewRequiredFix } from '../domain/query-smell.js';
import { createSmell, looksLikeDapperQuery } from './rule-helpers.js';
import { findAllPatternMatches } from './support/pattern-match.js';

const INTERPOLATED_SQL_PATTERN =
  /\$"(?:[^"\\]|\\.)*SELECT(?:[^"\\]|\\.)*"|\$@"(?:[^"]|""|\n)*SELECT(?:[^"]|""|\n)*"/i;
const CONCAT_SQL_PATTERN =
  /(?:"[^"]*SELECT[^"]*"\s*\+)|(?:\+\s*"[^"]*SELECT[^"]*")/i;

export const dapperStringConcatSqlRule: QueryRule = {
  code: 'DAPPER_STRING_CONCAT_SQL',

  analyze(request) {
    if (!looksLikeDapperQuery(request.code) && request.provider !== 'dapper') {
      return [];
    }

    const interpolated = findAllPatternMatches(request.code, INTERPOLATED_SQL_PATTERN)[0];
    const concatenated = findAllPatternMatches(request.code, CONCAT_SQL_PATTERN)[0];
    const match = interpolated ?? concatenated;

    if (!match) {
      return [];
    }

    return [
      createSmell({
        code: 'DAPPER_STRING_CONCAT_SQL',
        title: 'SQL built by string concatenation',
        severity: 'high',
        category: 'safety',
        message:
          'SQL appears to be built with string interpolation or concatenation instead of Dapper parameters.',
        whyItMatters:
          'Interpolating user-controlled values into SQL risks injection and prevents plan reuse.',
        suggestion: 'Use parameterized SQL with anonymous objects or DynamicParameters.',
        rewritePlan: [
          'Keep the SQL text static with @Parameter placeholders.',
          'Pass values through Dapper parameter objects.',
          'Avoid interpolating identifiers; whitelist columns/tables when dynamic SQL is required.'
        ],
        safeAutoFix: false,
        confidence: 0.84,
        range: match.range,
        fixes: [
          createReviewRequiredFix(
            'parameterize-dapper-sql',
            'Replace interpolated/concatenated SQL with parameters'
          )
        ]
      })
    ];
  }
};
