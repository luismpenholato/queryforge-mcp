import type { DatabaseProvider } from "../providers/provider.types.js";
import type { OptimizationResult } from "../query-optimization/optimization-result.types.js";
import type { OptimizationMode } from "../query-optimization/rewrite-plan.types.js";
import { assertProjectHasCsproj } from "../../shared/fs/project-path-validator.js";
import { getDapperCapability } from "../providers/provider-capabilities.js";
import {
  getAnalysisMode,
  isInMemoryProvider,
  requiresConservativeAnalysis,
  shouldBlockDapperSuggestion,
} from "../providers/provider-policy.js";
import { analyzeProjectStack } from "../project-stack/project-stack.service.js";
import { analyzeDapperAvailability } from "../dapper/dapper-detector.js";
import { analyzeQuery, getVersionNotesFromStack } from "../query-analysis/query-analysis.service.js";
import {
  buildMarkdownSummary,
  buildSummary,
  determineRiskLevel,
  optimizeEfQuery,
  sortProblemsBySeverity,
} from "./ef-query-optimizer.js";
import { computeBehaviorConfidence, computeBehaviorRisk } from "./behavior-risk.js";
import { shouldRecommendDapper } from "../dapper/dapper-suggestion.service.js";
import { suggestIndexes } from "../indexes/index-suggestion.service.js";
import { isComplexQuery } from "../query-analysis/query-complexity-analyzer.js";

export interface OptimizeExistingQueryInput {
  projectPath: string;
  code: string;
  goal?: string;
  provider?: DatabaseProvider | "Auto";
  preserveBehavior?: boolean;
  mode?: OptimizationMode;
  rewriteCode?: boolean;
}

export async function optimizeExistingQuery(
  input: OptimizeExistingQueryInput,
): Promise<OptimizationResult> {
  const {
    projectPath,
    code,
    goal,
    preserveBehavior = true,
    mode = "strict",
    rewriteCode = true,
  } = input;

  await assertProjectHasCsproj(projectPath);

  const stack = await analyzeProjectStack(projectPath);
  const dapperAvailability = await analyzeDapperAvailability(projectPath, stack);
  const analysis = analyzeQuery(code, stack, goal);
  const versionNotes = getVersionNotesFromStack(stack);

  const efOptimization = optimizeEfQuery(code, analysis, stack, {
    preserveBehavior,
    goal,
    mode,
    rewriteCode,
  });

  const indexSuggestions = suggestIndexes({
    provider:
      input.provider && input.provider !== "Auto"
        ? input.provider
        : stack.provider,
    code,
    projectStack: stack,
  });

  const riskLevel = determineRiskLevel(analysis.smells);
  const manualReviewCount = analysis.smells.filter((s) => s.needsManualReview).length;
  const complex = isComplexQuery(code, analysis.linqPattern);

  const dapperRecommended = shouldRecommendDapper(
    analysis,
    dapperAvailability.hasDapperPackage,
    "medium",
    stack,
    { riskLevel, complex, manualReviewCount },
  );

  let recommendedApproach: OptimizationResult["recommendedApproach"] = "NO_CHANGE_NEEDED";
  if (analysis.smells.length === 0) {
    recommendedApproach = "NO_CHANGE_NEEDED";
  } else if (
    manualReviewCount >= 3 ||
    (requiresConservativeAnalysis(stack) && analysis.smells.length > 0) ||
    (complex && mode === "strict")
  ) {
    recommendedApproach = "MANUAL_REVIEW";
  } else if (
    dapperRecommended &&
    analysis.isReadOnly &&
    !shouldBlockDapperSuggestion(stack) &&
    (dapperAvailability.hasDapperPackage || !dapperAvailability.requiresNewDependency)
  ) {
    recommendedApproach = "DAPPER";
  } else if (
    indexSuggestions.length > 0 &&
    analysis.smells.every((s) => s.severity === "low") &&
    !requiresConservativeAnalysis(stack)
  ) {
    recommendedApproach = "KEEP_CURRENT_WITH_INDEX";
  } else if (analysis.smells.length > 0) {
    recommendedApproach = "EF_OPTIMIZED";
  }

  const behaviorRisk = computeBehaviorRisk(analysis.smells, efOptimization.rewritePlan, code);
  if (recommendedApproach === "DAPPER") {
    // Dapper suggestions always require human validation.
  }

  const needsManualReview =
    efOptimization.needsManualReview ||
    conservativeManualReview(stack) ||
    recommendedApproach === "DAPPER" ||
    recommendedApproach === "MANUAL_REVIEW";

  const behaviorNotes =
    efOptimization.notes.length > 0
      ? efOptimization.notes
      : ["Review rewritePlan items and validate behavior with tests before applying changes."];

  const dapperCapability = getDapperCapability(stack);

  const optimizedEfCode =
    mode === "strict" ? null : efOptimization.optimizedCode ?? null;

  const result: OptimizationResult = {
    summary: isInMemoryProvider(stack)
      ? `${buildSummary(analysis.smells, mode)} (InMemory: not representative of production DB performance.)`
      : buildSummary(analysis.smells, mode),
    riskLevel,
    recommendedApproach,
    mode,
    behaviorPreservation: {
      preserved: preserveBehavior,
      confidence: computeBehaviorConfidence(behaviorRisk, needsManualReview),
      behaviorRisk:
        recommendedApproach === "DAPPER" && behaviorRisk === "none"
          ? "medium"
          : behaviorRisk,
      notes: behaviorNotes,
    },
    problems: sortProblemsBySeverity(analysis.smells),
    rewritePlan: efOptimization.rewritePlan,
    optimizedEfCode,
    dapperAlternative: {
      available: analysis.isReadOnly && dapperCapability.allowed && !shouldBlockDapperSuggestion(stack),
      recommended: dapperRecommended && dapperCapability.allowed && !shouldBlockDapperSuggestion(stack),
      requiresNewDependency: dapperAvailability.requiresNewDependency,
      reason: shouldBlockDapperSuggestion(stack)
        ? dapperCapability.reason
        : dapperCapability.allowed
          ? dapperRecommended
            ? "Read-only projection query with high EF optimization risk; validate SQL manually."
            : "EF optimization is preferred to preserve consistency."
          : dapperCapability.reason,
    },
    indexSuggestions,
    versionNotes,
    needsManualReview,
    analysisMode: analysis.analysisMode ?? getAnalysisMode(stack),
  };

  result.markdownSummary = buildMarkdownSummary({
    summary: result.summary,
    problems: result.problems,
    recommendedApproach: result.recommendedApproach,
    needsManualReview: result.needsManualReview,
    behaviorNotes,
    mode,
    rewritePlanCount: result.rewritePlan.length,
  });

  return result;
}

function conservativeManualReview(
  stack: Parameters<typeof requiresConservativeAnalysis>[0],
): boolean {
  return requiresConservativeAnalysis(stack);
}
