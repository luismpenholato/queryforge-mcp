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
    'Avoid ToString().Contains on numeric columns. This usually requires a business decision (computed column, normalized field, or selective in-memory filter after an indexed pre-filter).'
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

const INVARIANT_CULTURE = 'System.Globalization.CultureInfo.InvariantCulture';

export class EfRewriteService {
  suggest(code: string, analysis: QueryAnalysisResult): string {
    if (analysis.smells.length === 0) {
      return code;
    }

    const { rewritten, appliedChanges } = this.applySafeFixes(code, analysis);
    const manualReviewCodes = this.getManualReviewCodes(analysis, appliedChanges);
    const plan = this.buildRewritePlan(code, analysis, appliedChanges, manualReviewCodes);

    if (!plan) {
      return this.sanitizeRewriteOutput(rewritten);
    }

    return this.sanitizeRewriteOutput(`${plan}\n\n${rewritten}`);
  }

  private sanitizeRewriteOutput(output: string): string {
    let result = output;

    if (/ContinueWith/i.test(result)) {
      result = this.removeContinueWithChains(result);
    }

    return this.normalizeConceptualCultureInfo(result);
  }

  private normalizeConceptualCultureInfo(output: string): string {
    return output
      .replace(
        /\.ToString\s*\(\s*CultureInfo\.InvariantCulture\s*\)/g,
        `.ToString(${INVARIANT_CULTURE})`
      )
      .split('\n')
      .map((line) => this.normalizeCultureInfoReferences(line))
      .join('\n');
  }

  private removeContinueWithChains(code: string): string {
    let result = code;
    const pattern = /\.ContinueWith\s*\(/i;
    let match = pattern.exec(result);

    while (match) {
      const start = match.index;
      const openParenIndex = result.indexOf('(', start);
      let depth = 0;
      let end = openParenIndex;

      for (let index = openParenIndex; index < result.length; index += 1) {
        const char = result[index];

        if (char === '(') {
          depth += 1;
        }

        if (char === ')') {
          depth -= 1;

          if (depth === 0) {
            end = index + 1;

            while (end < result.length && /[\s,]/.test(result[end])) {
              end += 1;
            }

            if (result[end] === ';') {
              end += 1;
            }

            break;
          }
        }
      }

      result = `${result.slice(0, start)}${result.slice(end)}`;
      match = pattern.exec(result);
    }

    return result
      .split('\n')
      .filter((line) => !/ContinueWith/i.test(line))
      .join('\n');
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
    code: string,
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

    const integratedExample = this.buildIntegratedConceptualExample(code, manualReviewCodes);

    if (integratedExample.length > 0) {
      lines.push(...integratedExample);
      lines.push('');
    } else if (manualReviewCodes.includes('FUNCTION_ON_COLUMN_FILTER')) {
      const alias = this.extractWhereLambdaAlias(code) ?? 'x';
      const dateColumn = this.extractFunctionOnColumnName(code) ?? 'OrderedAt';

      lines.push('Conceptual example for DateTime.Year/Month:');
      lines.push(...this.buildYearBoundaryLines(code));
      lines.push(
        `query.Where(${alias} => ${alias}.${dateColumn} >= startDate && ${alias}.${dateColumn} < endDate)`
      );
      lines.push('');
    }

    if (
      manualReviewCodes.some((smellCode) =>
        ['TO_STRING_IN_QUERY_FILTER', 'CONTAINS_ON_CONVERTED_VALUE'].includes(smellCode)
      )
    ) {
      lines.push('Note on ToString/Contains filters:');
      lines.push('Avoid converting database columns to string inside SQL filters.');
      lines.push('Typical options require a business decision:');
      lines.push('- computed persisted column');
      lines.push('- normalized searchable field');
      lines.push('- search-specific strategy');
      lines.push('- selective in-memory filter only after an indexed pre-filter');
      lines.push('');

      if (integratedExample.length === 0) {
        lines.push(...this.buildInMemoryFilterExample());
        lines.push('');
      }
    }

    if (
      manualReviewCodes.some((code) => ['LARGE_TAKE', 'LARGE_TAKE_WITH_ORDER_BY'].includes(code))
    ) {
      lines.push('Note on Take SQL translation:');
      lines.push(
        'EF Core may translate Take to TOP or OFFSET/FETCH depending on provider and version.'
      );
      lines.push('Validate the generated SQL and execution plan for your target database.');
      lines.push('');
    }

    lines.push('*/');
    return lines.join('\n');
  }

  private buildIntegratedConceptualExample(
    code: string,
    manualReviewCodes: string[]
  ): string[] {
    const hasFunctionOnColumn = manualReviewCodes.includes('FUNCTION_ON_COLUMN_FILTER');
    const hasToStringFilter = manualReviewCodes.some((smellCode) =>
      ['TO_STRING_IN_QUERY_FILTER', 'CONTAINS_ON_CONVERTED_VALUE'].includes(smellCode)
    );

    if (!hasFunctionOnColumn || !hasToStringFilter) {
      return [];
    }

    const alias = this.extractWhereLambdaAlias(code) ?? 'x';
    const dateColumn = this.extractFunctionOnColumnName(code);
    const convertedColumn = this.extractToStringColumnName(code);
    const queryRoot = this.extractQueryRoot(code);
    const orderBy = this.extractOrderByClause(code);
    const take = this.extractTakeClause(code);
    const inMemoryFilter = this.extractInMemoryToStringFilter(code, alias);

    if (!dateColumn || !convertedColumn) {
      return [];
    }

    const lines: string[] = ['Conceptual rewrite example (not auto-applied):'];
    lines.push(...this.buildYearBoundaryLines(code));
    lines.push('');
    lines.push(`var items = await ${queryRoot}`);
    lines.push('    .AsNoTracking()');
    lines.push(
      `    .Where(${alias} => ${alias}.${dateColumn} >= startDate && ${alias}.${dateColumn} < endDate)`
    );

    if (orderBy) {
      lines.push(`    .${orderBy}`);
    }

    if (take) {
      lines.push(`    .${take}`);
    }

    lines.push(
      `    .Select(${alias} => new { ${alias}.Id, ${alias}.${dateColumn}, ${alias}.${convertedColumn} })`
    );
    lines.push('    .ToListAsync(ct);');
    lines.push('');
    lines.push(...this.buildInMemoryFilterReturnLines(alias, convertedColumn, inMemoryFilter));
    lines.push('');
    lines.push(
      'Only do this after a selective indexed filter significantly reduces the result set.'
    );

    if (take) {
      lines.push('');
      lines.push(...this.buildTakeBeforeInMemoryFilterNotes());
    }

    return lines;
  }

  private buildTakeBeforeInMemoryFilterNotes(): string[] {
    return [
      'Note on Take before in-memory filter:',
      'Pre-filter by date in the database and apply the converted-value filter in memory only if:',
      '- the result set after the date filter is acceptable;',
      '- applying Take before the in-memory filter does not change the business rule;',
      '- the returned volume does not pressure memory or latency.',
      'In-memory filtering is a pragmatic option, but validate semantics before production.'
    ];
  }

  private buildYearBoundaryLines(code: string): string[] {
    if (/DateTime\.UtcNow\.Year/.test(code)) {
      return [
        'var year = DateTime.UtcNow.Year;',
        'var startDate = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);',
        'var endDate = startDate.AddYears(1);'
      ];
    }

    if (/\bcurrentYear\b/.test(code)) {
      return [
        'var startDate = new DateTime(currentYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);',
        'var endDate = startDate.AddYears(1);'
      ];
    }

    if (/DateTime\.Now\.Year/.test(code)) {
      return [
        'var year = DateTime.Now.Year;',
        'var startDate = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);',
        'var endDate = startDate.AddYears(1);'
      ];
    }

    return [
      'var year = DateTime.UtcNow.Year;',
      'var startDate = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);',
      'var endDate = startDate.AddYears(1);'
    ];
  }

  private normalizeCultureInfoReferences(expression: string): string {
    return expression.replace(
      /(?<!System\.Globalization\.)CultureInfo\.InvariantCulture/g,
      INVARIANT_CULTURE
    );
  }

  private parseToStringContainsParts(
    alias: string,
    column: string,
    extracted: string | null
  ): { columnName: string; culture: string; containsArg: string } | null {
    const source = extracted ?? `${alias}.${column}.ToString().Contains("...")`;
    const match = new RegExp(
      `${alias}\\.(\\w+)\\.ToString\\(([^)]*)\\)[!.]*\\.Contains\\(([^)]+)\\)`
    ).exec(source.replace(/\s+/g, ''));

    if (!match) {
      return null;
    }

    const cultureArg = match[2].trim();

    return {
      columnName: match[1],
      culture: cultureArg
        ? this.normalizeCultureInfoReferences(cultureArg)
        : INVARIANT_CULTURE,
      containsArg: match[3]
    };
  }

  private buildInMemoryFilterReturnLines(
    alias: string,
    column: string,
    extracted: string | null
  ): string[] {
    const parts = this.parseToStringContainsParts(alias, column, extracted);

    if (parts) {
      return [
        'return items',
        `    .Where(${alias} =>`,
        `        ${alias}.${parts.columnName}`,
        `            .ToString(${parts.culture})`,
        `            .Contains(${parts.containsArg})`,
        '    )',
        '    .ToList();'
      ];
    }

    const filter = this.formatConceptualInMemoryFilter(alias, column, extracted);

    return ['return items', `    .Where(${filter})`, '    .ToList();'];
  }

  private formatConceptualInMemoryFilter(
    alias: string,
    column: string,
    extracted: string | null
  ): string {
    const parts = this.parseToStringContainsParts(alias, column, extracted);

    if (parts) {
      return `${alias} => ${alias}.${parts.columnName}.ToString(${parts.culture}).Contains(${parts.containsArg})`;
    }

    return `${alias} => ${alias}.${column}.ToString(${INVARIANT_CULTURE}).Contains("...")`;
  }

  private buildInMemoryFilterExample(): string[] {
    return [
      'Conceptual example for selective in-memory filter (not auto-applied):',
      'var items = await query',
      '    .ToListAsync(ct);',
      '',
      'return items',
      '    .Where(x => /* business rule not translatable to SQL */)',
      '    .ToList();',
      'Only do this after a selective indexed filter significantly reduces the result set.'
    ];
  }

  private extractWhereLambdaAlias(code: string): string | null {
    const match = /\.Where\s*\(\s*(\w+)\s*=>/.exec(code);
    return match?.[1] ?? null;
  }

  private extractFunctionOnColumnName(code: string): string | null {
    const match =
      /\w+\.((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*)\.(Year|Month|Day|Date|Hour|Minute|Second)\b/.exec(
        code
      );
    return match?.[1]?.split('.').pop() ?? null;
  }

  private extractToStringColumnName(code: string): string | null {
    const match = /\w+\.((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*)\.ToString\s*\(/.exec(code);
    return match?.[1]?.split('.').pop() ?? null;
  }

  private extractQueryRoot(code: string): string {
    const repositoryMatch = /await\s+(\w+\.\w+Repository\.Query\s*\(\s*\))/.exec(
      code.replace(/\s+/g, ' ')
    );

    if (repositoryMatch) {
      return repositoryMatch[1];
    }

    const contextMatch = /await\s+(_context\.\w+)/.exec(code.replace(/\s+/g, ' '));
    return contextMatch?.[1] ?? 'query';
  }

  private extractOrderByClause(code: string): string | null {
    const match =
      /\.(OrderByDescending|OrderBy|ThenByDescending|ThenBy)\s*\(\s*\w+\s*=>\s*[^)]+\)/.exec(code);

    return match?.[0].slice(1) ?? null;
  }

  private extractTakeClause(code: string): string | null {
    const match = /\.Take\s*\([^)]+\)/.exec(code);
    return match?.[0].slice(1) ?? null;
  }

  private extractInMemoryToStringFilter(code: string, alias: string): string | null {
    const match = new RegExp(
      `${alias}\\.\\w+(?:\\.\\w+)*\\.ToString(?:\\([^)]*\\))?[!.]*\\.Contains\\([^)]+\\)`
    ).exec(code);

    return match?.[0] ?? null;
  }

  private insertAsNoTracking(code: string): string {
    const dbSetPattern = /(_context\.[A-Za-z0-9_]+|\.Set<[^>]+>\s*\(\s*\))/;

    if (!dbSetPattern.test(code)) {
      return code;
    }

    return code.replace(dbSetPattern, (match) => `${match}.AsNoTracking()`);
  }
}
