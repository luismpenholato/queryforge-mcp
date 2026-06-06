import { DatabaseProvider } from '../domain/database-provider.js';
import { IndexCandidateRequest } from '../domain/index-candidate-request.js';
import { IndexCandidateResult } from '../domain/index-candidate-result.js';
import { IndexCandidate, IndexColumn } from '../domain/index-candidate.js';
import { QueryAnalysisService } from './query-analysis.service.js';

const RELATIONAL_PROVIDERS = new Set<DatabaseProvider>([
  'sql-server',
  'mysql',
  'mariadb',
  'postgresql',
  'sqlite',
  'oracle',
  'unknown'
]);

const DERIVED_MEMBER_NAMES = new Set([
  'Year',
  'Month',
  'Day',
  'Date',
  'Hour',
  'Minute',
  'Second',
  'ToString',
  'ToLower',
  'ToUpper',
  'Trim',
  'Substring'
]);

const SMELL_WARNINGS: Record<string, string> = {
  FUNCTION_ON_COLUMN_FILTER:
    'This index candidate may not help until function-on-column filters are rewritten to range predicates.',
  TO_STRING_IN_QUERY_FILTER:
    'String conversion filters are usually not solved by a normal B-tree index.',
  CONTAINS_ON_CONVERTED_VALUE:
    'String conversion filters are usually not solved by a normal B-tree index.',
  STRING_TRANSFORM_ON_COLUMN_FILTER:
    'String transformation filters are usually not solved by a normal B-tree index.',
  CARTESIAN_PRODUCT_QUERY:
    'Fix cartesian product/query shape before evaluating indexes.',
  N_PLUS_ONE_QUERY_IN_LOOP:
    'Indexes may reduce individual query cost, but they do not fix excessive round-trips.',
  MULTIPLE_ROUND_TRIPS_IN_LOOP:
    'Indexes may reduce individual query cost, but they do not fix excessive round-trips.',
  AS_ENUMERABLE_BEFORE_QUERY_OPERATORS:
    'Move filtering to the database before evaluating index candidates.',
  TO_LIST_BEFORE_WHERE:
    'Move filtering to the database before evaluating index candidates.',
  FULL_ENTITY_MATERIALIZATION:
    'Project only required columns before evaluating covering indexes.'
};

const CONFIDENCE_PENALTIES: Record<string, number> = {
  FUNCTION_ON_COLUMN_FILTER: 0.15,
  TO_STRING_IN_QUERY_FILTER: 0.15,
  CONTAINS_ON_CONVERTED_VALUE: 0.15,
  STRING_TRANSFORM_ON_COLUMN_FILTER: 0.15,
  CARTESIAN_PRODUCT_QUERY: 0.2
};

const REWRITE_REQUIRED_SMELLS = new Set([
  'FUNCTION_ON_COLUMN_FILTER',
  'TO_STRING_IN_QUERY_FILTER',
  'CONTAINS_ON_CONVERTED_VALUE',
  'STRING_TRANSFORM_ON_COLUMN_FILTER',
  'IMPLICIT_CONVERSION_IN_FILTER'
]);

const REWRITE_REQUIRED_REASON =
  'Function-on-column or non-sargable filters must be rewritten before this index can be useful.';

interface ColumnExtractionResult {
  columns: IndexColumn[];
  requiresQueryRewrite: boolean;
  deferredFilterColumns: string[];
}

export class IndexCandidateService {
  private readonly analysisService = new QueryAnalysisService();

  suggest(request: IndexCandidateRequest): IndexCandidateResult {
    const databaseProvider = request.databaseProvider ?? 'unknown';
    const analysis = this.analysisService.analyze({
      code: request.code,
      provider: 'ef-core',
      context: request.context
    });

    const smellCodes = analysis.smells.map((smell) => smell.code);
    const globalWarnings = this.buildGlobalWarnings(smellCodes, databaseProvider);
    const tableName = this.inferTableName(request.code, request.tableName);
    const extraction = this.buildIndexColumns(request.code, smellCodes);

    const candidates = this.buildCandidates(
      tableName,
      extraction,
      databaseProvider,
      smellCodes,
      globalWarnings,
      extraction.deferredFilterColumns
    );

    const summary = this.buildSummary(
      candidates,
      extraction.requiresQueryRewrite,
      extraction.deferredFilterColumns
    );
    const postRewriteEvaluation = extraction.requiresQueryRewrite
      ? this.buildPostRewriteEvaluation(tableName, extraction, databaseProvider)
      : undefined;
    const notRecommendedNotes = this.buildNotRecommendedNotes(extraction, smellCodes);

    return {
      summary,
      databaseProvider,
      tableName,
      candidates,
      warnings: globalWarnings,
      analysisSmells: smellCodes,
      manualReviewRequired: true,
      postRewriteEvaluation,
      notRecommendedNotes: notRecommendedNotes.length > 0 ? notRecommendedNotes : undefined
    };
  }

  private buildNotRecommendedNotes(
    extraction: ColumnExtractionResult,
    smellCodes: string[]
  ): string[] {
    const notes: string[] = [];

    for (const column of extraction.deferredFilterColumns) {
      notes.push(
        `Normal B-tree indexes do not solve the current non-sargable filter on ${column} (for example ToString/Contains or string transformation).`
      );
    }

    if (smellCodes.includes('FUNCTION_ON_COLUMN_FILTER')) {
      notes.push(
        'Function-on-column filters (Year, Month, DATEPART, etc.) are not solved by indexing the derived member. Rewrite to a range on the base column first.'
      );
    }

    if (
      smellCodes.some((smellCode) =>
        ['TO_STRING_IN_QUERY_FILTER', 'CONTAINS_ON_CONVERTED_VALUE'].includes(smellCode)
      ) &&
      extraction.deferredFilterColumns.length === 0
    ) {
      notes.push(
        'String conversion filters are not solved by a normal B-tree index. Rewrite or redesign the filter before expecting index benefit.'
      );
    }

    return notes;
  }

  private buildSummary(
    candidates: IndexCandidate[],
    requiresQueryRewrite: boolean,
    deferredFilterColumns: string[]
  ): string {
    if (candidates.length === 0) {
      return 'No safe direct index candidate was generated from the current heuristics.';
    }

    const conditionalCount = candidates.filter((candidate) => candidate.requiresQueryRewrite).length;
    const primaryColumns = candidates[0].columns.map((column) => column.name).join(', ');

    if (conditionalCount === candidates.length && requiresQueryRewrite) {
      if (deferredFilterColumns.length > 0) {
        return `After rewriting non-sargable filters, the first candidate targets ${primaryColumns}. Additional composite keys (${deferredFilterColumns.join(', ')}) require per-column filter rewrites.`;
      }

      return `After rewriting non-sargable filters, the first candidate targets ${primaryColumns}.`;
    }

    if (conditionalCount > 0) {
      return `Generated ${candidates.length} conservative index candidate(s) for review (${conditionalCount} conditional on query rewrite).`;
    }

    return `Generated ${candidates.length} conservative index candidate(s) for review.`;
  }

  private buildCandidates(
    tableName: string,
    extraction: ColumnExtractionResult,
    databaseProvider: DatabaseProvider,
    smellCodes: string[],
    globalWarnings: string[],
    deferredFilterColumns: string[]
  ): IndexCandidate[] {
    const { columns, requiresQueryRewrite } = extraction;

    if (columns.length === 0) {
      return [];
    }

    const candidates: IndexCandidate[] = [];
    const composite = this.createCandidate(
      tableName,
      columns.slice(0, 4),
      databaseProvider,
      smellCodes,
      globalWarnings,
      'composite',
      requiresQueryRewrite,
      deferredFilterColumns
    );

    if (composite) {
      candidates.push(composite);
    }

    const equalityColumns = columns.filter((column) => column.kind === 'equality');

    if (
      candidates.length < 2 &&
      equalityColumns.length >= 2 &&
      columns.length > equalityColumns.length &&
      !requiresQueryRewrite
    ) {
      const equalityOnly = this.createCandidate(
        tableName,
        equalityColumns.slice(0, 4),
        databaseProvider,
        smellCodes,
        globalWarnings,
        'equality-only',
        false,
        []
      );

      if (equalityOnly) {
        candidates.push(equalityOnly);
      }
    }

    return candidates.slice(0, 2);
  }

  private createCandidate(
    tableName: string,
    columns: IndexColumn[],
    databaseProvider: DatabaseProvider,
    smellCodes: string[],
    globalWarnings: string[],
    variant: 'composite' | 'equality-only',
    requiresQueryRewrite: boolean,
    deferredFilterColumns: string[]
  ): IndexCandidate | null {
    if (columns.length === 0 || columns.some((column) => this.isDerivedMemberColumn(column.name))) {
      return null;
    }

    const indexName = this.buildIndexName(tableName, columns);
    const reasons = this.buildReasons(columns, variant, requiresQueryRewrite);
    const warnings = [...globalWarnings];
    const confidence = this.calculateConfidence(columns, smellCodes, tableName, requiresQueryRewrite);

    if (variant === 'equality-only') {
      reasons.push('Equality-only candidate provided as an alternative lookup pattern.');
    }

    if (requiresQueryRewrite) {
      warnings.push(
        'This candidate may only help after function-on-column or non-sargable filters are rewritten to range predicates.'
      );
      reasons.push(
        'Primary candidate after rewrite: compare base columns directly without Year/Month/ToString/Trim in predicates.'
      );

      for (const deferredColumn of deferredFilterColumns) {
        reasons.push(
          `${deferredColumn} should not be added to the index until its filter is rewritten to a sargable typed numeric or range comparison.`
        );
      }
    }

    return {
      tableName,
      columns,
      sql: RELATIONAL_PROVIDERS.has(databaseProvider)
        ? this.buildSql(databaseProvider, indexName, tableName, columns)
        : undefined,
      confidence,
      reasons,
      warnings,
      manualReviewRequired: true,
      requiresQueryRewrite: requiresQueryRewrite || undefined,
      rewriteRequiredReason: requiresQueryRewrite ? REWRITE_REQUIRED_REASON : undefined
    };
  }

  private buildIndexColumns(code: string, smellCodes: string[]): ColumnExtractionResult {
    const equality = this.extractEqualityColumns(code);
    const range = this.extractRangeColumns(code);
    const ordering = this.extractOrderingColumns(code);
    const nonSargableFilterColumns = this.extractNonSargableFilterColumns(code);
    const sargableRangeNames = new Set(
      range.filter((item) => !item.hasDerivedMember).map((item) => item.name)
    );
    const sargableEqualityNames = new Set(
      equality.filter((item) => !item.hasDerivedMember).map((item) => item.name)
    );
    const orderingNames = new Set(
      ordering.filter((item) => !item.hasDerivedMember).map((item) => item.name)
    );
    const requiresQueryRewrite =
      smellCodes.some((code) => REWRITE_REQUIRED_SMELLS.has(code)) ||
      equality.some((item) => item.hasDerivedMember) ||
      range.some((item) => item.hasDerivedMember) ||
      nonSargableFilterColumns.length > 0;

    const merged: IndexColumn[] = [];
    const seen = new Set<string>();

    for (const item of equality) {
      if (item.hasDerivedMember) {
        continue;
      }

      if (!seen.has(item.name)) {
        merged.push({ name: item.name, kind: 'equality' });
        seen.add(item.name);
      }
    }

    for (const item of range) {
      if (item.hasDerivedMember) {
        continue;
      }

      if (!seen.has(item.name)) {
        merged.push({ name: item.name, kind: 'range', direction: item.direction });
        seen.add(item.name);
      } else {
        const existing = merged.find((column) => column.name === item.name);

        if (existing && item.direction) {
          existing.direction = item.direction;
        }
      }
    }

    for (const item of ordering) {
      if (item.hasDerivedMember || this.isDerivedMemberColumn(item.name)) {
        continue;
      }

      if (!seen.has(item.name)) {
        merged.push({ name: item.name, kind: 'ordering', direction: item.direction });
        seen.add(item.name);
      } else {
        const existing = merged.find((column) => column.name === item.name);

        if (existing && item.direction) {
          existing.direction = item.direction;
        }
      }
    }

    const filteredColumns = merged.filter((column) => {
      if (!nonSargableFilterColumns.includes(column.name)) {
        return true;
      }

      return (
        orderingNames.has(column.name) ||
        sargableRangeNames.has(column.name) ||
        sargableEqualityNames.has(column.name)
      );
    });
    const deferredFilterColumns = nonSargableFilterColumns.filter(
      (columnName) => !filteredColumns.some((column) => column.name === columnName)
    );

    return {
      columns: filteredColumns.slice(0, 4),
      requiresQueryRewrite,
      deferredFilterColumns
    };
  }

  private extractNonSargableFilterColumns(code: string): string[] {
    const columns = new Set<string>();
    const patterns = [
      /[a-zA-Z_]\w*\.((?:[A-Za-z_]\w*\.)*[A-Za-z_]\w*)\.(Year|Month|Day|Date|Hour|Minute|Second|ToLower|ToUpper|Trim|Substring)\b/g,
      /[a-zA-Z_]\w*\.((?:[A-Za-z_]\w*\.)*[A-Za-z_]\w*)\.ToString\s*\(/gi,
      /[a-zA-Z_]\w*\.((?:[A-Za-z_]\w*\.)*[A-Za-z_]\w*)\.ToString\s*\([^)]*\)[!.]*\.Contains/gi
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(code)) !== null) {
        const resolved = this.resolveColumnAccess(match[1]);
        columns.add(resolved.columnName);
      }
    }

    return [...columns];
  }

  private buildPostRewriteEvaluation(
    tableName: string,
    extraction: ColumnExtractionResult,
    databaseProvider: DatabaseProvider
  ): string[] {
    const anchorColumn =
      extraction.columns.find((column) => column.kind === 'ordering' || column.kind === 'range') ??
      extraction.columns[0];

    if (!anchorColumn) {
      return [];
    }

    const notes: string[] = [];

    notes.push(
      `After rewriting the ${anchorColumn.name} filter to a sargable range predicate, the first candidate is:`
    );

    const primaryIndexName = this.buildIndexName(tableName, [anchorColumn]);
    notes.push(
      RELATIONAL_PROVIDERS.has(databaseProvider)
        ? this.buildSql(databaseProvider, primaryIndexName, tableName, [anchorColumn])
        : `-- Generic relational index candidate\nCREATE INDEX ${primaryIndexName}\nON ${tableName} (${anchorColumn.name}${anchorColumn.direction ? ` ${anchorColumn.direction}` : ''});`
    );

    for (const deferredColumn of extraction.deferredFilterColumns) {
      const compositeColumns: IndexColumn[] = [
        { ...anchorColumn },
        { name: deferredColumn, kind: 'equality' }
      ];
      const compositeIndexName = this.buildIndexName(tableName, compositeColumns);

      notes.push(
        `If the ${deferredColumn} filter is also rewritten to a sargable typed numeric or range comparison, a composite candidate may be evaluated:`
      );
      notes.push(
        RELATIONAL_PROVIDERS.has(databaseProvider)
          ? this.buildSql(databaseProvider, compositeIndexName, tableName, compositeColumns)
          : `-- Generic relational index candidate\nCREATE INDEX ${compositeIndexName}\nON ${tableName} (${anchorColumn.name}${anchorColumn.direction ? ` ${anchorColumn.direction}` : ''}, ${deferredColumn});`
      );
      notes.push(
        `${deferredColumn} should not be added to the index before that filter rewrite.`
      );
    }

    return notes;
  }

  private extractEqualityColumns(
    code: string
  ): Array<{ name: string; hasDerivedMember: boolean }> {
    const columns: Array<{ name: string; hasDerivedMember: boolean }> = [];
    const patterns = [
      /[a-zA-Z_]\w*\.((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*)\s*==/g,
      /[a-zA-Z_]\w*\.((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*)\.Equals\s*\(/g
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(code)) !== null) {
        const resolved = this.resolveColumnAccess(match[1]);

        if (!columns.some((column) => column.name === resolved.columnName)) {
          columns.push({
            name: resolved.columnName,
            hasDerivedMember: resolved.hasDerivedMember
          });
        }
      }
    }

    return columns;
  }

  private extractRangeColumns(
    code: string
  ): Array<{ name: string; direction?: 'ASC' | 'DESC'; hasDerivedMember: boolean }> {
    const columns: Array<{ name: string; direction?: 'ASC' | 'DESC'; hasDerivedMember: boolean }> =
      [];
    const pattern = /[a-zA-Z_]\w*\.((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*)\s*(?:>=|>|<=|<)\s*/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(code)) !== null) {
      const resolved = this.resolveColumnAccess(match[1]);

      if (!columns.some((column) => column.name === resolved.columnName)) {
        columns.push({
          name: resolved.columnName,
          hasDerivedMember: resolved.hasDerivedMember
        });
      }
    }

    return columns;
  }

  private extractOrderingColumns(
    code: string
  ): Array<{ name: string; direction: 'ASC' | 'DESC'; hasDerivedMember: boolean }> {
    const columns: Array<{ name: string; direction: 'ASC' | 'DESC'; hasDerivedMember: boolean }> =
      [];
    const patterns = [
      {
        regex: /\.OrderByDescending\s*\(\s*\w+\s*=>\s*\w+\.((?:\w+\.)*\w+)\s*\)/g,
        direction: 'DESC' as const
      },
      {
        regex: /\.OrderBy\s*\(\s*\w+\s*=>\s*\w+\.((?:\w+\.)*\w+)\s*\)/g,
        direction: 'ASC' as const
      },
      {
        regex: /\.ThenByDescending\s*\(\s*\w+\s*=>\s*\w+\.((?:\w+\.)*\w+)\s*\)/g,
        direction: 'DESC' as const
      },
      {
        regex: /\.ThenBy\s*\(\s*\w+\s*=>\s*\w+\.((?:\w+\.)*\w+)\s*\)/g,
        direction: 'ASC' as const
      }
    ];

    for (const { regex, direction } of patterns) {
      let match: RegExpExecArray | null;

      while ((match = regex.exec(code)) !== null) {
        const resolved = this.resolveColumnAccess(match[1]);

        if (!columns.some((column) => column.name === resolved.columnName)) {
          columns.push({
            name: resolved.columnName,
            direction,
            hasDerivedMember: resolved.hasDerivedMember
          });
        }
      }
    }

    return columns;
  }

  private resolveColumnAccess(accessChain: string): {
    columnName: string;
    hasDerivedMember: boolean;
  } {
    const parts = accessChain
      .split('.')
      .map((part) => part.replace(/\(\s*\)$/, '').trim())
      .filter((part) => part.length > 0);

    if (parts.length === 0) {
      return { columnName: accessChain, hasDerivedMember: false };
    }

    let hasDerivedMember = false;
    const normalizedParts = [...parts];

    while (
      normalizedParts.length > 0 &&
      this.isDerivedMemberColumn(normalizedParts[normalizedParts.length - 1])
    ) {
      hasDerivedMember = true;
      normalizedParts.pop();
    }

    if (normalizedParts.length === 0) {
      return { columnName: parts[0], hasDerivedMember: true };
    }

    return {
      columnName: normalizedParts[normalizedParts.length - 1],
      hasDerivedMember
    };
  }

  private isDerivedMemberColumn(name: string): boolean {
    const normalized = name.replace(/\(\s*\)$/, '').trim();
    return DERIVED_MEMBER_NAMES.has(normalized);
  }

  private inferTableName(code: string, explicitTableName?: string): string {
    if (explicitTableName?.trim()) {
      return explicitTableName.trim();
    }

    const contextMatch = /_context\.([A-Za-z_]\w*)/.exec(code);

    if (contextMatch) {
      return contextMatch[1];
    }

    const bareContextMatch = /context\.([A-Za-z_]\w*)/.exec(code);

    if (bareContextMatch) {
      return bareContextMatch[1];
    }

    const repositoryMatch = /([A-Za-z_]\w*)Repository\.Query\s*\(/.exec(code);

    if (repositoryMatch) {
      return this.pluralizeEntity(repositoryMatch[1]);
    }

    const setMatch = /\.Set<([A-Za-z_]\w*)>\s*\(/.exec(code);

    if (setMatch) {
      return this.pluralizeEntity(setMatch[1]);
    }

    return 'UnknownTable';
  }

  private pluralizeEntity(entityName: string): string {
    if (entityName.endsWith('y')) {
      return `${entityName.slice(0, -1)}ies`;
    }

    if (entityName.endsWith('s')) {
      return entityName;
    }

    return `${entityName}s`;
  }

  private buildIndexName(tableName: string, columns: IndexColumn[]): string {
    return `IX_${tableName}_${columns.map((column) => column.name).join('_')}`;
  }

  private buildSql(
    provider: DatabaseProvider,
    indexName: string,
    tableName: string,
    columns: IndexColumn[]
  ): string {
    const columnSql = columns
      .map((column) => {
        if (!column.direction) {
          return column.name;
        }

        return `${column.name} ${column.direction}`;
      })
      .join(', ');

    if (provider === 'unknown') {
      return `-- Generic relational index candidate\nCREATE INDEX ${indexName}\nON ${tableName} (${columnSql});`;
    }

    return `CREATE INDEX ${indexName}\nON ${tableName} (${columnSql});`;
  }

  private buildReasons(
    columns: IndexColumn[],
    variant: 'composite' | 'equality-only',
    requiresQueryRewrite: boolean
  ): string[] {
    const reasons: string[] = [];

    if (requiresQueryRewrite) {
      reasons.push(
        'The query filters using derived members that may translate to SQL functions on the column.'
      );
    }

    for (const column of columns) {
      if (column.kind === 'equality') {
        reasons.push(`Query filters by equality column ${column.name}.`);
      }

      if (column.kind === 'range') {
        reasons.push(`Query filters by range column ${column.name}.`);
      }

      if (column.kind === 'ordering') {
        reasons.push(
          `Query orders by ${column.name}${column.direction ? ` ${column.direction}` : ''}.`
        );
      }
    }

    if (variant === 'composite' && columns.some((column) => column.kind === 'equality')) {
      reasons.push('Equality columns are placed before range/order columns.');
    }

    return reasons;
  }

  private calculateConfidence(
    columns: IndexColumn[],
    smellCodes: string[],
    tableName: string,
    requiresQueryRewrite: boolean
  ): number {
    let confidence = 0.65;

    if (columns.some((column) => column.kind === 'equality')) {
      confidence += 0.1;
    }

    if (columns.some((column) => column.kind === 'range')) {
      confidence += 0.1;
    }

    if (columns.some((column) => column.kind === 'ordering')) {
      confidence += 0.05;
    }

    for (const smellCode of smellCodes) {
      confidence -= CONFIDENCE_PENALTIES[smellCode] ?? 0;
    }

    if (tableName === 'UnknownTable') {
      confidence -= 0.1;
    }

    if (requiresQueryRewrite) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  private buildGlobalWarnings(
    smellCodes: string[],
    databaseProvider: DatabaseProvider
  ): string[] {
    const warnings: string[] = [];

    if (!RELATIONAL_PROVIDERS.has(databaseProvider)) {
      warnings.push(
        'Relational index candidates may not apply to this database provider. Review provider-specific indexing guidance.'
      );
    }

    for (const smellCode of smellCodes) {
      const warning = SMELL_WARNINGS[smellCode];

      if (warning && !warnings.includes(warning)) {
        warnings.push(warning);
      }
    }

    if (databaseProvider === 'unknown') {
      warnings.push(
        'Database provider is unknown. Generated SQL is generic and requires manual adaptation.'
      );
    }

    if (smellCodes.some((smellCode) => REWRITE_REQUIRED_SMELLS.has(smellCode))) {
      warnings.push(
        'Creating an index before the query rewrite tends to be maintenance cost without gain.'
      );
    }

    warnings.push(
      'Covering indexes with INCLUDE columns are an advanced manual decision. Validate execution plan, projected columns, write frequency and column width before adding INCLUDE.'
    );

    return warnings;
  }
}
