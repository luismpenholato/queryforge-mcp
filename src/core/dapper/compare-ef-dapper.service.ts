import type { OptimizationResult } from "../query-optimization/optimization-result.types.js";
import { analyzeProjectStack } from "../project-stack/project-stack.service.js";
import { analyzeDapperAvailability } from "../dapper/dapper-detector.js";
import { analyzeQuery } from "../query-analysis/query-analysis.service.js";
import { optimizeEfQuery } from "../query-optimization/ef-query-optimizer.js";
import { shouldRecommendDapper } from "../dapper/dapper-suggestion.service.js";

export interface CompareEfVsDapperInput {
  projectPath: string;
  code: string;
  queryCriticality?: "low" | "medium" | "high";
  estimatedRows?: number;
}

export async function compareEfVsDapper(input: CompareEfVsDapperInput) {
  const stack = await analyzeProjectStack(input.projectPath);
  const dapperAvailability = await analyzeDapperAvailability(input.projectPath, stack);
  const analysis = analyzeQuery(input.code, stack);
  const efOptimization = optimizeEfQuery(input.code, analysis, stack);
  const criticality = input.queryCriticality ?? "medium";

  const efScore = calculateEfScore(analysis, efOptimization.optimizedCode);
  const dapperScore = calculateDapperScore(
    analysis,
    dapperAvailability.hasDapperPackage,
    criticality,
    input.estimatedRows,
  );

  const dapperRecommended = shouldRecommendDapper(
    analysis,
    dapperAvailability.hasDapperPackage,
    criticality,
    stack,
  );

  const recommendation: OptimizationResult["recommendedApproach"] =
    analysis.smells.length === 0
      ? "NO_CHANGE_NEEDED"
      : dapperRecommended && dapperScore > efScore
        ? "DAPPER"
        : "EF_OPTIMIZED";

  return {
    recommendation,
    confidence: efOptimization.needsManualReview ? ("medium" as const) : ("high" as const),
    efOptimized: {
      score: efScore,
      pros: [
        "Keeps project consistency.",
        efOptimization.optimizedCode
          ? "Projection and filtering can be moved before materialization."
          : "Minimal change surface.",
      ],
      cons: ["Less control over generated SQL."],
    },
    dapper: {
      score: dapperScore,
      pros: ["Predictable SQL.", "Fine-grained control over joins and projections."],
      cons: [
        "Manual mapping and higher maintenance cost.",
        ...(dapperAvailability.requiresNewDependency ? ["Requires new Dapper dependency."] : []),
      ],
      requiresNewDependency: dapperAvailability.requiresNewDependency,
    },
    decisionReason:
      recommendation === "DAPPER"
        ? "The query is read-only, critical, and Dapper is already available."
        : recommendation === "NO_CHANGE_NEEDED"
          ? "No significant issues detected."
          : "The query can be safely optimized with EF by addressing detected smells.",
  };
}

function calculateEfScore(
  analysis: ReturnType<typeof analyzeQuery>,
  optimizedCode?: string,
): number {
  let score = 85;
  const highCount = analysis.smells.filter((s) => s.severity === "high").length;
  score -= highCount * 10;
  if (!optimizedCode && analysis.smells.length > 0) score -= 15;
  if (analysis.hasTrackingRisk) score -= 20;
  return Math.max(20, Math.min(95, score));
}

function calculateDapperScore(
  analysis: ReturnType<typeof analyzeQuery>,
  hasDapper: boolean,
  criticality: "low" | "medium" | "high",
  estimatedRows?: number,
): number {
  if (!analysis.isReadOnly) return 20;

  let score = 62;
  if (hasDapper) score += 10;
  if (criticality === "high") score += 15;
  if (analysis.linqPattern.hasDtoProjection) score += 10;
  if (estimatedRows && estimatedRows > 10000) score += 10;
  if (analysis.hasTrackingRisk) score -= 30;

  return Math.max(20, Math.min(90, score));
}
