import type { DatabaseProvider } from "../providers/provider.types.js";
import type { ProjectStack } from "../project-stack/project-stack.types.js";
import type { DapperAlternative } from "../query-optimization/optimization-result.types.js";
import type { QueryAnalysis } from "../query-analysis/query-analysis.types.js";
import {
  getConnectionType,
  getDapperCapability,
} from "../providers/provider-capabilities.js";
import {
  shouldBlockDapperSuggestion,
  shouldBlockSpecificSql,
} from "../providers/provider-policy.js";
import { analyzeCodeForSqlHints } from "../query-analysis/sql-pattern-analyzer.js";
import { inferDtoName } from "../../shared/text/text-utils.js";
import { analyzeProjectStack } from "../project-stack/project-stack.service.js";
import { analyzeDapperAvailability } from "./dapper-detector.js";
import { analyzeQuery } from "../query-analysis/query-analysis.service.js";

export interface DapperSuggestOptions {
  dtoName?: string;
  provider?: DatabaseProvider | "Auto";
  onlyIfDapperExists?: boolean;
  hasDapper: boolean;
}

export interface SuggestDapperAlternativeInput {
  projectPath: string;
  code: string;
  dtoName?: string;
  provider?: DatabaseProvider | "Auto";
  onlyIfDapperExists?: boolean;
}

export function suggestDapperQuery(
  code: string,
  analysis: QueryAnalysis,
  projectStack: ProjectStack | undefined,
  options: DapperSuggestOptions,
): DapperAlternative {
  const stack = projectStack ?? createFallbackStack(options.provider);
  const dapperCapability = getDapperCapability(stack);

  if (shouldBlockDapperSuggestion(stack) || !dapperCapability.allowed) {
    return {
      available: false,
      recommended: false,
      hasDapper: options.hasDapper,
      requiresNewDependency: !options.hasDapper,
      reason: dapperCapability.reason || `Dapper is not supported for ${stack.provider}.`,
      warnings: stack.providerWarnings,
      needsManualReview: true,
    };
  }

  const provider =
    options.provider && options.provider !== "Auto"
      ? options.provider
      : stack.provider;

  const requiresNewDependency = !options.hasDapper;
  const dtoName = options.dtoName ?? inferDtoName(code) ?? "ResultDto";
  const connectionType = getConnectionType(provider);

  if (options.onlyIfDapperExists && !options.hasDapper) {
    return {
      available: false,
      recommended: false,
      hasDapper: false,
      requiresNewDependency: true,
      reason: "Dapper is not installed in the project.",
      warnings: ["Install Dapper before adopting this alternative."],
      needsManualReview: true,
    };
  }

  if (shouldBlockSpecificSql(stack)) {
    return {
      available: false,
      recommended: false,
      hasDapper: options.hasDapper,
      requiresNewDependency,
      reason: "Provider-specific SQL generation is disabled for this provider.",
      warnings: stack.providerWarnings,
      needsManualReview: true,
    };
  }

  if (!analysis.isReadOnly || analysis.hasTrackingRisk) {
    return {
      available: false,
      recommended: false,
      hasDapper: options.hasDapper,
      requiresNewDependency,
      reason: "Dapper is only suggested for read-only queries without tracking.",
      warnings: [],
      needsManualReview: false,
    };
  }

  const sqlHints = analyzeCodeForSqlHints(code);
  const tableMatch = code.match(/_context\.(\w+)/);
  const table = tableMatch?.[1] ?? "Entities";

  const whereClause = buildWhereClause(sqlHints.whereColumns);
  const sql = `SELECT *\nFROM ${table}\n${whereClause}\n${sqlHints.orderByColumns.length ? `ORDER BY ${sqlHints.orderByColumns.join(", ")}` : ""};`.trim();

  const parameters = extractParameters(code);
  const csharpCode = generateDapperMethod(dtoName, connectionType, sql, parameters);

  const canSuggest = analysis.linqPattern.hasDtoProjection || analysis.linqPattern.hasSelect;
  const complex = analysis.smells.some(
    (s) =>
      s.type === "MULTIPLE_COLLECTION_INCLUDES" ||
      s.type === "CUSTOM_METHOD_IN_WHERE" ||
      s.type === "CLIENT_EVALUATION_RISK",
  );

  const needsManualReview =
    dapperCapability.needsManualReview || stack.providerSupportLevel === "best_effort";

  return {
    available: true,
    recommended: canSuggest && !complex && options.hasDapper && !needsManualReview,
    hasDapper: options.hasDapper,
    requiresNewDependency,
    reason: canSuggest
      ? "The query is read-only and projection-based; SQL control may help."
      : "Query pattern is too complex for confident Dapper generation.",
    sql,
    csharpCode,
    parameters,
    warnings: [
      "Validate generated SQL against the current schema.",
      "Validate performance with execution plan.",
      "Generated SQL uses parameterized queries only.",
      ...stack.providerWarnings,
    ],
    needsManualReview,
  };
}

export async function suggestDapperAlternative(
  input: SuggestDapperAlternativeInput,
): Promise<DapperAlternative & { canSuggestDapper: boolean }> {
  const stack = await analyzeProjectStack(input.projectPath);
  const dapperAvailability = await analyzeDapperAvailability(input.projectPath, stack);
  const analysis = analyzeQuery(input.code, stack);

  const suggestion = suggestDapperQuery(input.code, analysis, stack, {
    dtoName: input.dtoName,
    provider: input.provider,
    onlyIfDapperExists: input.onlyIfDapperExists ?? true,
    hasDapper: dapperAvailability.hasDapperPackage,
  });

  return {
    canSuggestDapper: suggestion.available,
    ...suggestion,
  };
}

function createFallbackStack(provider?: DatabaseProvider | "Auto"): ProjectStack {
  const resolved = provider && provider !== "Auto" ? provider : "SqlServer";
  return {
    projectPath: "",
    projects: [],
    targetFrameworks: [],
    primaryTargetFramework: "unknown",
    csharpVersion: "unknown",
    efKind: "unknown",
    efVersion: "unknown",
    provider: resolved,
    providerFamily: "Relational",
    providerSupportLevel: "first_class",
    providerConfidence: "low",
    providerWarnings: [],
    detectedProviderPackages: [],
    hasDapper: false,
    dapperVersion: "unknown",
    limitations: [],
    supportedOptimizations: [],
    warnings: [],
  };
}

function buildWhereClause(columns: string[]): string {
  if (columns.length === 0) return "WHERE 1 = 1";
  const conditions = columns.map((col) => `${col} = @${col}`);
  return `WHERE ${conditions.join(" AND ")}`;
}

function extractParameters(code: string): Array<{ name: string; source: string; type: string }> {
  const params: Array<{ name: string; source: string; type: string }> = [];
  const whereRegex = /\.Where\s*\(\s*\w+\s*=>\s*(\w+)\.(\w+)\s*==\s*(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = whereRegex.exec(code)) !== null) {
    params.push({
      name: match[2],
      source: match[3],
      type: "int",
    });
  }
  return params;
}

function generateDapperMethod(
  dtoName: string,
  connectionType: string,
  sql: string,
  parameters: Array<{ name: string; source: string; type: string }>,
): string {
  const paramObj =
    parameters.length > 0
      ? `{ ${parameters.map((p) => `${p.name} = ${p.source}`).join(", ")} }`
      : "new { }";

  return `public async Task<List<${dtoName}>> Get${dtoName.replace(/Dto$/i, "")}Async(${parameters.map((p) => `${p.type} ${p.source}`).join(", ") || "CancellationToken cancellationToken = default"})
{
    const sql = @"${sql.replace(/"/g, '""')}";
    await using var connection = new ${connectionType}(/* connection string */);
    var result = await connection.QueryAsync<${dtoName}>(sql, ${paramObj});
    return result.ToList();
}`;
}

export function shouldRecommendDapper(
  analysis: QueryAnalysis,
  hasDapper: boolean,
  queryCriticality: "low" | "medium" | "high" = "medium",
  projectStack?: ProjectStack,
  context?: {
    riskLevel?: "low" | "medium" | "high";
    complex?: boolean;
    manualReviewCount?: number;
  },
): boolean {
  if (projectStack && shouldBlockDapperSuggestion(projectStack)) return false;

  if (projectStack) {
    const capability = getDapperCapability(projectStack);
    if (!capability.allowed) return false;
    if (projectStack.providerSupportLevel === "detection_only") return false;
    if (projectStack.providerSupportLevel === "best_effort" && !hasDapper) return false;
    if (projectStack.providerFamily !== "Relational") return false;
  }

  if (!analysis.isReadOnly || analysis.hasTrackingRisk) return false;
  if (!analysis.linqPattern.hasDtoProjection && !analysis.linqPattern.hasSelect) return false;
  if (analysis.smells.length === 0) return false;
  if (context?.complex) return false;

  const highImpact = analysis.smells.some(
    (s) => s.severity === "high" && s.type !== "MISSING_AS_NO_TRACKING",
  );

  const risky = (context?.riskLevel === "high" || (context?.manualReviewCount ?? 0) >= 2) ?? false;

  return highImpact && risky && queryCriticality !== "low" && hasDapper;
}
