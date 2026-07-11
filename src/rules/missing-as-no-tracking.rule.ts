import { QueryRule } from '../domain/query-rule.js';
import { resolveReadOnlyContext } from '../domain/query-analysis-request.js';
import { createSmell, looksLikeEfQuery } from './rule-helpers.js';
import { buildAsNoTrackingFix, findAsNoTrackingInsertionRange } from './support/query-fixes.js';

export const missingAsNoTrackingRule: QueryRule = {
  code: 'MISSING_AS_NO_TRACKING',

  analyze(request) {
    const code = request.code;
    const hasProjection = /\.Select\s*\(/.test(code);
    const hasTrackingDisabled = /\.AsNoTracking\s*\(/.test(code);
    const hasWriteOperation =
      /\.(?:Add|Update|Remove|Attach)\s*\(|SaveChanges|SaveChangesAsync/.test(code);

    if (!looksLikeEfQuery(code) || hasTrackingDisabled || hasWriteOperation) {
      return [];
    }

    const readOnlyContext = resolveReadOnlyContext(request);

    if (!hasProjection && !readOnlyContext) {
      return [];
    }

    const range = findAsNoTrackingInsertionRange(code);
    const fix = buildAsNoTrackingFix(code);

    return [
      createSmell({
        code: 'MISSING_AS_NO_TRACKING',
        title: 'Read-only query without AsNoTracking',
        severity: 'medium',
        message:
          'The query appears to be read-only and does not use AsNoTracking, which may create unnecessary EF Core tracking overhead.',
        suggestion: 'Add AsNoTracking() on read-only queries to reduce tracking overhead.',
        confidence: hasProjection ? 0.75 : 0.55,
        range,
        fixes: fix ? [fix] : undefined,
        safeAutoFix: Boolean(fix)
      })
    ];
  }
};
