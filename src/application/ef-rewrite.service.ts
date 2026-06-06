import { QueryAnalysisResult } from '../domain/query-analysis-result.js';

const PLAN_FALLBACKS: Record<string, string[]> = {
  FUNCTION_ON_COLUMN_FILTER: [
    'Replace DateTime.Year/Month/Day/Hour members with a range filter on the original column.',
    'Compute start/end boundaries in application code and validate timezone/business rules.'
  ],
  REDUNDANT_MONTH_RANGE_FILTER: [
    'Remove the redundant month filter (new[] { 1..12 }.Contains(column.Month)) unless there is a specific business reason.'
  ],
  TO_STRING_IN_QUERY_FILTER: [
    'Avoid ToString() on database columns inside Where. Prefer typed comparisons or a dedicated search field.'
  ],
  CONTAINS_ON_CONVERTED_VALUE: [
    'Avoid ToString().Contains on numeric columns. This usually requires a business decision (computed column, normalized field, or selective in-memory filter).'
  ],
  STRING_TRANSFORM_ON_COLUMN_FILTER: [
    'Prefer normalized persisted columns, case-insensitive collation, or provider-specific indexed strategy instead of ToLower/ToUpper/Trim in Where.'
  ],
  CLIENT_SIDE_METHOD_IN_WHERE: [
    'Replace custom methods in Where with expression-based filters translatable to SQL, or move logic to the database.'
  ],
  LARGE_TAKE_WITH_ORDER_BY: [
    'Review Take size, pagination strategy, and whether indexes cover the OrderBy columns.'
  ],
  LARGE_TAKE: [
    'Review page size, batching strategy, and memory usage for large Take values.'
  ],
  MULTIPLE_COLLECTION_INCLUDES: [
    'Consider projection to DTO, filtered includes, or AsSplitQuery when multiple collection includes are required.'
  ],
  TO_LIST_BEFORE_SELECT: [
    'Move Select before ToList/ToListAsync so projection runs in the database.',
    'Remove unnecessary Includes when projecting directly to a DTO.'
  ],
  TO_LIST_BEFORE_WHERE: ['Move Where before ToList/ToListAsync.'],
  TO_LIST_BEFORE_ORDER_BY: ['Move OrderBy before ToList/ToListAsync.'],
  TO_LIST_BEFORE_SKIP_TAKE: ['Move Skip/Take before ToList/ToListAsync and ensure stable OrderBy.']
};

type RewriteMode = 'yes' | 'partial' | 'no';

export class EfRewriteService {
  suggest(code: string, analysis: QueryAnalysisResult): string {
    if (analysis.smells.length === 0) {
      return code;
    }

    const { rewritten, appliedChanges } = this.applySafeFixes(code, analysis);
    const manualReviewCodes = this.getManualReviewCodes(analysis, appliedChanges);
    const plan = this.buildRewritePlan(analysis, appliedChanges, manualReviewCodes);

    if (!plan) {
      return rewritten;
    }

    return `${plan}\n\n${rewritten}`;
  }

  private applySafeFixes(
    code: string,
    analysis: QueryAnalysisResult
  ): { rewritten: string; appliedChanges: string[] } {
    let rewritten = code;
    const appliedChanges: string[] = [];

    const hasMissingAsNoTracking = analysis.smells.some(
      (item) => item.code === 'MISSING_AS_NO_TRACKING'
    );

    const hasCountGreaterThanZero = analysis.smells.some(
      (item) => item.code === 'COUNT_GREATER_THAN_ZERO'
    );

    if (hasMissingAsNoTracking && !rewritten.includes('.AsNoTracking()')) {
      const withTracking = this.insertAsNoTracking(rewritten);

      if (withTracking !== rewritten) {
        rewritten = withTracking;
        appliedChanges.push('Added AsNoTracking() for read-only query.');
      }
    }

    if (hasCountGreaterThanZero) {
      const withAny = rewritten
        .replace(/\.CountAsync\s*\(([^)]*)\)\s*>\s*0/g, '.AnyAsync($1)')
        .replace(/\.Count\s*\(([^)]*)\)\s*>\s*0/g, '.Any($1)')
        .replace(/\.CountAsync\s*\(([^)]*)\)\s*>=\s*1/g, '.AnyAsync($1)')
        .replace(/\.Count\s*\(([^)]*)\)\s*>=\s*1/g, '.Any($1)');

      if (withAny !== rewritten) {
        rewritten = withAny;
        appliedChanges.push('Replaced Count/CountAsync greater-than-zero check with Any/AnyAsync.');
      }
    }

    return { rewritten, appliedChanges };
  }

  private getManualReviewCodes(
    analysis: QueryAnalysisResult,
    appliedChanges: string[]
  ): string[] {
    const remaining = new Set(analysis.smells.map((smell) => smell.code));

    if (appliedChanges.some((change) => change.includes('AsNoTracking'))) {
      remaining.delete('MISSING_AS_NO_TRACKING');
    }

    if (appliedChanges.some((change) => change.includes('Any'))) {
      remaining.delete('COUNT_GREATER_THAN_ZERO');
    }

    return [...remaining];
  }

  private resolveRewriteMode(appliedChanges: string[], manualReviewCodes: string[]): RewriteMode {
    if (appliedChanges.length > 0 && manualReviewCodes.length === 0) {
      return 'yes';
    }

    if (appliedChanges.length > 0 && manualReviewCodes.length > 0) {
      return 'partial';
    }

    return 'no';
  }

  private collectPlanSteps(analysis: QueryAnalysisResult, manualReviewCodes: string[]): string[] {
    const steps: string[] = [];
    const seen = new Set<string>();

    for (const code of manualReviewCodes) {
      const smell = analysis.smells.find((item) => item.code === code);

      if (!smell) {
        continue;
      }

      const candidates = smell.rewritePlan?.length ? smell.rewritePlan : PLAN_FALLBACKS[code] ?? [];

      for (const step of candidates) {
        if (!seen.has(step)) {
          seen.add(step);
          steps.push(step);
        }
      }
    }

    return steps;
  }

  private buildRewritePlan(
    analysis: QueryAnalysisResult,
    appliedChanges: string[],
    manualReviewCodes: string[]
  ): string | null {
    if (analysis.smells.length === 0) {
      return null;
    }

    const rewriteMode = this.resolveRewriteMode(appliedChanges, manualReviewCodes);
    const lines: string[] = ['/*', 'QueryForge EF rewrite suggestion', '', `Safe automatic rewrite: ${rewriteMode}`, ''];

    if (appliedChanges.length > 0) {
      lines.push('Applied safe changes:');

      for (const change of appliedChanges) {
        lines.push(`- ${change}`);
      }

      lines.push('');
    }

    if (manualReviewCodes.length > 0) {
      lines.push('Manual review required:');

      for (const code of manualReviewCodes) {
        lines.push(`- ${code}`);
      }

      lines.push('');
      lines.push('Why automatic rewrite was not fully applied:');
      lines.push(
        'This query contains performance smells that require business, schema, or provider decisions.'
      );
      lines.push(
        'QueryForge does not apply aggressive automatic rewrites for non-sargable filters or risky transformations.'
      );
      lines.push('');
    }

    const planSteps = this.collectPlanSteps(analysis, manualReviewCodes);

    if (planSteps.length > 0) {
      lines.push('Suggested rewrite plan:');

      planSteps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });

      lines.push('');
    }

    if (manualReviewCodes.includes('FUNCTION_ON_COLUMN_FILTER')) {
      lines.push('Conceptual example for DateTime.Year/Month:');
      lines.push('var startDate = new DateTime(currentYear, 1, 1);');
      lines.push('var endDate = startDate.AddYears(1);');
      lines.push('query.Where(x => x.OrderedAt >= startDate && x.OrderedAt < endDate)');
      lines.push('');
    }

    if (
      manualReviewCodes.some((code) =>
        ['TO_STRING_IN_QUERY_FILTER', 'CONTAINS_ON_CONVERTED_VALUE'].includes(code)
      )
    ) {
      lines.push('Note on ToString/Contains filters:');
      lines.push('Avoid converting database columns to string inside SQL filters.');
      lines.push('Typical options require a business decision:');
      lines.push('- computed persisted column');
      lines.push('- normalized searchable field');
      lines.push('- search-specific strategy');
      lines.push('- apply in memory only after a selective indexed filter');
      lines.push('');
    }

    lines.push('*/');
    return lines.join('\n');
  }

  private insertAsNoTracking(code: string): string {
    const dbSetPattern = /(_context\.[A-Za-z0-9_]+|\.Set<[^>]+>\s*\(\s*\))/;

    if (!dbSetPattern.test(code)) {
      return code;
    }

    return code.replace(dbSetPattern, (match) => `${match}.AsNoTracking()`);
  }
}
