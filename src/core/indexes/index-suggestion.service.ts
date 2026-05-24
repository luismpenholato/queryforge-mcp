import type { DatabaseProvider } from "../providers/provider.types.js";
import type { IndexSuggestion } from "./index-suggestion.types.js";
import type { ProjectStack } from "../project-stack/project-stack.types.js";
import { analyzeCodeForSqlHints, analyzeSqlPatterns } from "../query-analysis/sql-pattern-analyzer.js";
import { getProviderRules } from "../providers/provider-capabilities.js";
import {
  shouldBlockCreateIndexSql,
  shouldBlockIndexSuggestions,
} from "../providers/provider-policy.js";
import { extractTableNames } from "../../shared/text/text-utils.js";

const VALIDATION_WARNINGS = [
  "Validate with actual execution plan.",
  "Consider write overhead before adding this index.",
  "Index suggestions are not guarantees of performance improvement.",
];

export interface SuggestIndexesInput {
  provider: DatabaseProvider;
  code?: string;
  sql?: string;
  tableName?: string;
}

export function suggestIndexes(options: {
  provider: DatabaseProvider;
  code?: string;
  sql?: string;
  tableName?: string;
  projectStack?: Pick<
    ProjectStack,
    "provider" | "providerFamily" | "providerSupportLevel" | "providerWarnings"
  >;
}): IndexSuggestion[] {
  const { provider, code, sql, tableName, projectStack } = options;
  const stackContext = projectStack ?? {
    provider,
    providerFamily: "Relational" as const,
    providerSupportLevel: "first_class" as const,
    providerWarnings: [],
  };

  if (shouldBlockIndexSuggestions(stackContext)) {
    return [];
  }

  const blockCreateIndexSql = shouldBlockCreateIndexSql(stackContext);

  const providerRules = getProviderRules(provider);

  const patterns = sql
    ? analyzeSqlPatterns(sql)
    : code
      ? analyzeCodeForSqlHints(code)
      : {
          whereColumns: [],
          joinColumns: [],
          orderByColumns: [],
          groupByColumns: [],
          hasLeadingWildcardLike: false,
          hasSelectStar: false,
          hasFunctionOnFilteredColumn: false,
        };

  const table =
    tableName ??
    (code ? extractTableNames(code)[0] : undefined) ??
    inferTableFromSql(sql) ??
    "TableName";

  const suggestions: IndexSuggestion[] = [];
  const filterColumns = [...new Set(patterns.whereColumns.map(normalizeColumn))].filter(Boolean);
  const orderColumns = [...new Set(patterns.orderByColumns.map(normalizeColumn))].filter(Boolean);

  if (provider === "Cosmos") {
    return [
      {
        provider,
        table,
        name: "ReviewCosmosIndexingPolicy",
        columns: filterColumns.length ? filterColumns : ["ReviewFields"],
        sql: "-- Review Cosmos DB indexing policy for this container instead of CREATE INDEX SQL.",
        reason: "Cosmos DB uses indexing policy configuration, not relational CREATE INDEX.",
        warnings: [...VALIDATION_WARNINGS, ...stackContext.providerWarnings],
        confidence: "low",
        conceptual: true,
      },
    ];
  }

  if (provider === "MongoDB") {
    if (filterColumns.length === 0 && orderColumns.length === 0) {
      return [];
    }
    return [
      {
        provider,
        table,
        name: `idx_${table}_${[...filterColumns, ...orderColumns].slice(0, 3).join("_") || "fields"}`,
        columns: [...filterColumns, ...orderColumns],
        sql: `-- Conceptual MongoDB document index (not SQL CREATE INDEX): review fields ${[...filterColumns, ...orderColumns].join(", ")}`,
        reason: "The query filters or sorts document fields that may benefit from a document index.",
        warnings: [
          ...VALIDATION_WARNINGS,
          "Validate with MongoDB explain plan.",
          "This is a conceptual document index suggestion, not SQL CREATE INDEX.",
        ],
        confidence: "low",
        conceptual: true,
      },
    ];
  }

  if (filterColumns.length > 0 || orderColumns.length > 0) {
    const columns = [...filterColumns, ...orderColumns.filter((c) => !filterColumns.includes(c))];
    const indexName = buildIndexName(table, columns);
    const supportsInclude = providerRules.supportsIncludeIndex && !blockCreateIndexSql;
    const sqlStatement = blockCreateIndexSql
      ? `-- Conceptual index on ${table} (${columns.join(", ")})`
      : buildCreateIndexSql(provider, table, indexName, columns, orderColumns, supportsInclude);

    suggestions.push({
      provider,
      table,
      name: indexName,
      columns: columns.map((c) => (orderColumns.includes(c) ? `${c} DESC` : c)),
      includeColumns: supportsInclude ? [] : undefined,
      sql: sqlStatement,
      reason: buildReason(filterColumns, orderColumns),
      warnings: [...VALIDATION_WARNINGS, ...providerRules.warnings, ...stackContext.providerWarnings],
      confidence: blockCreateIndexSql ? "low" : "medium",
      conceptual: blockCreateIndexSql,
    });
  }

  if (patterns.hasLeadingWildcardLike || patterns.hasFunctionOnFilteredColumn) {
    suggestions.push({
      provider,
      table,
      name: `IX_${table}_ReviewRequired`,
      columns: ["ReviewFilteredColumns"],
      sql: blockCreateIndexSql
        ? "-- Review required: filter pattern may be expensive for this provider."
        : `-- Review required: leading wildcard LIKE or function on filtered column may prevent index usage.`,
      reason: "Pattern may prevent efficient index usage.",
      warnings: [
        ...VALIDATION_WARNINGS,
        "Consider computed columns or full-text search depending on provider.",
      ],
      confidence: "low",
      conceptual: true,
    });
  }

  return suggestions;
}

export function suggestIndexesTool(input: SuggestIndexesInput) {
  const suggestions = suggestIndexes(input);
  return { suggestions };
}

function normalizeColumn(col: string): string {
  return col.replace(/^\w+\./, "").trim();
}

function buildIndexName(table: string, columns: string[]): string {
  const suffix = columns.slice(0, 3).join("_");
  return `IX_${table}_${suffix}`;
}

function buildCreateIndexSql(
  provider: DatabaseProvider,
  table: string,
  name: string,
  columns: string[],
  orderColumns: string[],
  supportsInclude: boolean,
): string {
  void supportsInclude;
  const colDefs = columns
    .map((c) => (orderColumns.includes(c) ? `${c} DESC` : c))
    .join(", ");

  switch (provider) {
    case "SqlServer":
    case "AzureSql":
      return `CREATE INDEX ${name} ON ${table} (${colDefs});`;
    case "PostgreSql":
    case "CockroachDb":
      return `CREATE INDEX ${name} ON ${table} (${colDefs});`;
    case "MySql":
    case "MariaDb":
      return `CREATE INDEX ${name} ON ${table} (${colDefs});`;
    case "SQLite":
      return `CREATE INDEX ${name} ON ${table} (${colDefs});`;
    case "Oracle":
      return `CREATE INDEX ${name} ON ${table} (${colDefs});`;
    default:
      return `-- Conceptual CREATE INDEX ${name} ON ${table} (${colDefs});`;
  }
}

function buildReason(filterColumns: string[], orderColumns: string[]): string {
  const parts: string[] = [];
  if (filterColumns.length) {
    parts.push(`filters by ${filterColumns.join(", ")}`);
  }
  if (orderColumns.length) {
    parts.push(`orders by ${orderColumns.join(", ")}`);
  }
  return `The query ${parts.join(" and ")}.`;
}

function inferTableFromSql(sql?: string): string | undefined {
  if (!sql) return undefined;
  const match = sql.match(/FROM\s+(\w+)/i);
  return match?.[1];
}
