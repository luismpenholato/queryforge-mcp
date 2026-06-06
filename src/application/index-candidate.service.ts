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

const SMELL_WARNINGS: Record<string, string> = {
  FUNCTION_ON_COLUMN_FILTER:
    'This index candidate may not help until function-on-column filters are rewritten to range predicates.',
  TO_STRING_IN_QUERY_FILTER:
    'String conversion filters are usually not solved by a normal B-tree index.',
  CONTAINS_ON_CONVERTED_VALUE:
    'String conversion filters are usually not solved by a normal B-tree index.',
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
  CARTESIAN_PRODUCT_QUERY: 0.2
};

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
    const columns = this.buildIndexColumns(request.code);

    const candidates = this.buildCandidates(
      tableName,
      columns,
      databaseProvider,
      smellCodes,
      globalWarnings
    );

    const summary =
      candidates.length > 0
        ? `Generated ${candidates.length} conservative index candidate(s) for review.`
        : 'No index candidates could be generated from the current heuristics.';

    return {
      summary,
      databaseProvider,
      tableName,
      candidates,
      warnings: globalWarnings,
      analysisSmells: smellCodes,
      manualReviewRequired: true
    };
  }

  private buildCandidates(
    tableName: string,
    columns: IndexColumn[],
    databaseProvider: DatabaseProvider,
    smellCodes: string[],
    globalWarnings: string[]
  ): IndexCandidate[] {
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
      'composite'
    );

    if (composite) {
      candidates.push(composite);
    }

    const equalityColumns = columns.filter((column) => column.kind === 'equality');

    if (
      candidates.length < 2 &&
      equalityColumns.length >= 2 &&
      columns.length > equalityColumns.length
    ) {
      const equalityOnly = this.createCandidate(
        tableName,
        equalityColumns.slice(0, 4),
        databaseProvider,
        smellCodes,
        globalWarnings,
        'equality-only'
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
    variant: 'composite' | 'equality-only'
  ): IndexCandidate | null {
    if (columns.length === 0) {
      return null;
    }

    const indexName = this.buildIndexName(tableName, columns);
    const reasons = this.buildReasons(columns, variant);
    const warnings = [...globalWarnings];
    const confidence = this.calculateConfidence(columns, smellCodes, tableName);

    if (variant === 'equality-only') {
      reasons.push('Equality-only candidate provided as an alternative lookup pattern.');
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
      manualReviewRequired: true
    };
  }

  private buildIndexColumns(code: string): IndexColumn[] {
    const equality = this.extractEqualityColumns(code);
    const range = this.extractRangeColumns(code);
    const ordering = this.extractOrderingColumns(code);
    const merged: IndexColumn[] = [];
    const seen = new Set<string>();

    for (const name of equality) {
      if (!seen.has(name)) {
        merged.push({ name, kind: 'equality' });
        seen.add(name);
      }
    }

    for (const item of range) {
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

    return merged.slice(0, 4);
  }

  private extractEqualityColumns(code: string): string[] {
    const columns: string[] = [];
    const patterns = [
      /[a-zA-Z_]\w*\.([A-Za-z_]\w*)\s*==/g,
      /[a-zA-Z_]\w*\.([A-Za-z_]\w*)\.Equals\s*\(/g
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(code)) !== null) {
        if (!columns.includes(match[1])) {
          columns.push(match[1]);
        }
      }
    }

    return columns;
  }

  private extractRangeColumns(code: string): Array<{ name: string; direction?: 'ASC' | 'DESC' }> {
    const columns: Array<{ name: string; direction?: 'ASC' | 'DESC' }> = [];
    const pattern = /[a-zA-Z_]\w*\.([A-Za-z_]\w*)\s*(?:>=|>|<=|<)\s*/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(code)) !== null) {
      const columnName = match[1];

      if (!columns.some((column) => column.name === columnName)) {
        columns.push({ name: columnName });
      }
    }

    return columns;
  }

  private extractOrderingColumns(code: string): Array<{ name: string; direction: 'ASC' | 'DESC' }> {
    const columns: Array<{ name: string; direction: 'ASC' | 'DESC' }> = [];
    const patterns = [
      { regex: /\.OrderByDescending\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g, direction: 'DESC' as const },
      { regex: /\.OrderBy\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g, direction: 'ASC' as const },
      { regex: /\.ThenByDescending\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g, direction: 'DESC' as const },
      { regex: /\.ThenBy\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g, direction: 'ASC' as const }
    ];

    for (const { regex, direction } of patterns) {
      let match: RegExpExecArray | null;

      while ((match = regex.exec(code)) !== null) {
        if (!columns.some((column) => column.name === match![1])) {
          columns.push({ name: match[1], direction });
        }
      }
    }

    return columns;
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

  private buildReasons(columns: IndexColumn[], variant: 'composite' | 'equality-only'): string[] {
    const reasons: string[] = [];

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

    if (variant === 'composite') {
      reasons.push('Equality columns are placed before range/order columns.');
    }

    return reasons;
  }

  private calculateConfidence(
    columns: IndexColumn[],
    smellCodes: string[],
    tableName: string
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

    return warnings;
  }
}
