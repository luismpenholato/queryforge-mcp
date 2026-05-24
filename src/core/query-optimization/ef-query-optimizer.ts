import type { ProjectStack } from "../project-stack/project-stack.types.js";
import type { QueryAnalysis } from "../query-analysis/query-analysis.types.js";
import type { QuerySmell, QuerySmellType } from "../query-analysis/query-smell.types.js";
import type { RiskLevel } from "../query-analysis/query-analysis.types.js";
import type { OptimizationMode, RewritePlanItem, RewritePlanResult } from "./rewrite-plan.types.js";
import { isEfFeatureSupported } from "../project-stack/ef-version-rules.js";
import {
  getConservativeAnalysisNotes,
  requiresConservativeAnalysis,
  shouldSkipRelationalOptimizations,
} from "../providers/provider-policy.js";
import {
  isComplexQuery,
  isSimpleMaterializationChain,
} from "../query-analysis/query-complexity-analyzer.js";

export interface OptimizeOptions {
  preserveBehavior?: boolean;
  goal?: string;
  mode?: OptimizationMode;
  rewriteCode?: boolean;
}

const BLOCKED_AUTO_TRANSFORM_TYPES = new Set<QuerySmellType>([
  "UNNECESSARY_INCLUDE_WITH_PROJECTION",
  "MULTIPLE_COLLECTION_INCLUDES",
  "LARGE_CONTAINS_RISK",
  "FUNCTION_ON_FILTERED_COLUMN",
  "CUSTOM_METHOD_IN_WHERE",
  "GROUP_BY_NAVIGATION_OR_OBJECT",
  "FIRST_OR_DEFAULT_WITHOUT_ORDER",
  "SKIP_TAKE_WITHOUT_ORDER_BY",
]);

export function optimizeEfQuery(
  code: string,
  analysis: QueryAnalysis,
  projectStack?: ProjectStack,
  options: OptimizeOptions = { preserveBehavior: true, mode: "strict" },
): RewritePlanResult {
  const mode = options.mode ?? "strict";
  const rewriteCode = options.rewriteCode ?? true;
  const smells = analysis.smells;
  const pattern = analysis.linqPattern;
  const notes: string[] = [];
  const rewritePlan: RewritePlanItem[] = [];
  let needsManualReview = smells.some((s) => s.needsManualReview);
  const complex = isComplexQuery(code, pattern);

  if (smells.length === 0) {
    return {
      rewritePlan: [],
      optimizedCode: mode === "safe" ? code : undefined,
      needsManualReview: false,
      appliedTransformations: [],
      notes: ["No optimizations needed."],
    };
  }

  if (complex) {
    needsManualReview = true;
    notes.push("Complex query detected — automatic consolidated rewrite is disabled.");
  }

  proposeAsNoTracking(code, projectStack, smells, rewritePlan);
  proposeMoveSelectBeforeMaterialization(code, pattern, smells, rewritePlan);
  proposeMoveWhereBeforeMaterialization(code, pattern, smells, rewritePlan);
  proposeMovePaginationBeforeMaterialization(code, smells, rewritePlan);
  proposeCountToAny(code, smells, rewritePlan);

  if (
    projectStack &&
    !shouldSkipRelationalOptimizations(projectStack) &&
    smells.some((s) => s.type === "MULTIPLE_COLLECTION_INCLUDES") &&
    isEfFeatureSupported(projectStack.efKind, projectStack.efVersion, "AsSplitQuery")
  ) {
    rewritePlan.push({
      id: "consider-as-split-query",
      title: "Consider AsSplitQuery for multiple collection includes",
      confidence: "low",
      safeToAutoApply: false,
      requiresManualReview: true,
      reason: "Multiple collection Includes may cause cartesian explosion.",
      before: code.trim(),
      after: code.trim(),
    });
    notes.push("Consider AsSplitQuery() if multiple collection includes are required.");
  }

  if (requiresConservativeAnalysis(projectStack) && projectStack) {
    needsManualReview = true;
    notes.push(...getConservativeAnalysisNotes(projectStack));
  }

  if (!options.preserveBehavior) {
    needsManualReview = true;
    notes.push("preserveBehavior=false — review equivalence carefully.");
  }

  if (smells.some((s) => BLOCKED_AUTO_TRANSFORM_TYPES.has(s.type) && s.needsManualReview)) {
    needsManualReview = true;
  }

  const appliedTransformations: string[] = [];
  let optimizedCode: string | undefined;

  if (mode === "strict") {
    notes.push("Strict mode: review rewritePlan items manually; no consolidated optimizedEfCode is emitted.");
  } else if (rewriteCode && canEmitConsolidatedRewrite(rewritePlan, smells, complex)) {
    const applyResult = applyHighConfidencePlan(code, rewritePlan, projectStack);
    optimizedCode = applyResult.code;
    appliedTransformations.push(...applyResult.applied);
    if (applyResult.applied.length === 0) {
      needsManualReview = true;
      notes.push("Safe mode: no high-confidence transformations could be applied automatically.");
    }
  } else if (mode === "safe") {
    needsManualReview = true;
    notes.push("Safe mode: consolidated rewrite skipped due to manual review requirements or rewriteCode=false.");
  }

  if (appliedTransformations.length === 0 && smells.some((s) => s.severity !== "low")) {
    needsManualReview = true;
  }

  return {
    rewritePlan,
    optimizedCode,
    needsManualReview,
    appliedTransformations,
    notes,
  };
}

function canEmitConsolidatedRewrite(
  rewritePlan: RewritePlanItem[],
  smells: QuerySmell[],
  complex: boolean,
): boolean {
  if (complex) return false;
  if (smells.some((s) => s.severity === "high" && s.needsManualReview)) return false;
  if (rewritePlan.some((item) => item.requiresManualReview && item.safeToAutoApply)) return false;

  const autoItems = rewritePlan.filter((item) => item.safeToAutoApply && item.confidence === "high");
  if (autoItems.length === 0) return false;

  return autoItems.every((item) => !item.requiresManualReview);
}

function applyHighConfidencePlan(
  code: string,
  rewritePlan: RewritePlanItem[],
  projectStack?: ProjectStack,
): { code?: string; applied: string[] } {
  let optimized = code;
  const applied: string[] = [];

  for (const item of rewritePlan) {
    if (!item.safeToAutoApply || item.confidence !== "high" || item.requiresManualReview) {
      continue;
    }

    if (item.after === item.before) {
      continue;
    }

    if (item.id === "add-as-no-tracking") {
      const result = tryAddAsNoTracking(optimized, projectStack);
      if (result.changed) {
        optimized = result.code;
        applied.push("AsNoTracking");
      }
      continue;
    }

    if (item.id === "count-to-any") {
      const result = tryReplaceCountWithAny(optimized);
      if (result.changed) {
        optimized = result.code;
        applied.push("AnyInsteadOfCount");
      }
      continue;
    }

    if (
      item.id === "move-select-before-materialization" ||
      item.id === "move-where-before-materialization" ||
      item.id === "move-pagination-before-materialization"
    ) {
      optimized = item.after;
      applied.push(item.id);
    }
  }

  return { code: applied.length > 0 ? optimized : undefined, applied };
}

function proposeAsNoTracking(
  code: string,
  projectStack: ProjectStack | undefined,
  smells: QuerySmell[],
  rewritePlan: RewritePlanItem[],
): void {
  const smell = smells.find((s) => s.type === "MISSING_AS_NO_TRACKING");
  if (!smell) return;

  const result = tryAddAsNoTracking(code, projectStack);
  rewritePlan.push({
    id: "add-as-no-tracking",
    title: "Add AsNoTracking for read-only query",
    confidence: smell.confidence,
    safeToAutoApply: smell.canAutoFix && result.changed,
    requiresManualReview: smell.needsManualReview,
    reason:
      smell.safeFix ??
      "Read-only query without tracking mutations detected in the provided snippet.",
    before: code.trim(),
    after: result.changed ? result.code.trim() : code.trim(),
  });
}

function proposeMoveSelectBeforeMaterialization(
  code: string,
  pattern: QueryAnalysis["linqPattern"],
  smells: QuerySmell[],
  rewritePlan: RewritePlanItem[],
): void {
  const smell = smells.find(
    (s) =>
      s.type === "EARLY_MATERIALIZATION" ||
      s.type === "DTO_PROJECTION_AFTER_MATERIALIZATION" ||
      s.type === "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO",
  );
  if (!smell || !pattern.hasDtoProjection) return;

  const result = trySimpleProjectionReorder(code);
  rewritePlan.push({
    id: "move-select-before-materialization",
    title: "Move Select projection before materialization",
    confidence: smell.canAutoFix ? smell.confidence : "low",
    safeToAutoApply: smell.canAutoFix && result.changed && isSimpleMaterializationChain(code, pattern),
    requiresManualReview: smell.needsManualReview,
    reason: smell.suggestion,
    before: code.trim(),
    after: result.changed ? result.code.trim() : code.trim(),
  });
}

function proposeMoveWhereBeforeMaterialization(
  code: string,
  pattern: QueryAnalysis["linqPattern"],
  smells: QuerySmell[],
  rewritePlan: RewritePlanItem[],
): void {
  if (!pattern.hasToListBeforeWhere || pattern.hasToListBeforeSelect) return;
  const smell = smells.find((s) => s.type === "EARLY_MATERIALIZATION");
  if (!smell) return;

  const result = tryMoveWhereBeforeMaterialization(code);
  rewritePlan.push({
    id: "move-where-before-materialization",
    title: "Move Where before materialization",
    confidence: smell.canAutoFix ? smell.confidence : "low",
    safeToAutoApply: smell.canAutoFix && result.changed && isSimpleMaterializationChain(code, pattern),
    requiresManualReview: smell.needsManualReview,
    reason: smell.suggestion,
    before: code.trim(),
    after: result.changed ? result.code.trim() : code.trim(),
  });
}

function proposeMovePaginationBeforeMaterialization(
  code: string,
  smells: QuerySmell[],
  rewritePlan: RewritePlanItem[],
): void {
  const smell = smells.find((s) => s.type === "IN_MEMORY_PAGINATION");
  if (!smell) return;

  rewritePlan.push({
    id: "move-pagination-before-materialization",
    title: "Apply pagination before materialization",
    confidence: smell.canAutoFix ? smell.confidence : "low",
    safeToAutoApply: false,
    requiresManualReview: true,
    reason: smell.suggestion,
    before: code.trim(),
    after: code.trim(),
  });
}

function proposeCountToAny(code: string, smells: QuerySmell[], rewritePlan: RewritePlanItem[]): void {
  const smell = smells.find((s) => s.type === "COUNT_GREATER_THAN_ZERO");
  if (!smell) return;

  const result = tryReplaceCountWithAny(code);
  rewritePlan.push({
    id: "count-to-any",
    title: "Use Any/AnyAsync instead of Count for existence checks",
    confidence: smell.confidence,
    safeToAutoApply: smell.canAutoFix && result.changed,
    requiresManualReview: smell.needsManualReview,
    reason: smell.safeFix ?? smell.suggestion,
    before: code.trim(),
    after: result.changed ? result.code.trim() : code.trim(),
  });
}

function tryMoveWhereBeforeMaterialization(code: string): { changed: boolean; code: string } {
  const pattern =
    /(?:var|List<\w+>)\s+(\w+)\s*=\s*await\s+(_context\.\w+)([\s\S]*?)\.ToListAsync\s*\(\s*\)\s*;\s*\n?\s*return\s+\1\.Where\s*\(\s*([^)]+)\s*\)([\s\S]*?);/;

  if (!pattern.test(code)) {
    return { changed: false, code };
  }

  const optimized = code.replace(
    pattern,
    (_match, _varName, contextSet, middleChain, whereBody, tail) =>
      `return await ${contextSet}${middleChain}\n        .Where(${whereBody})${tail.replace(/\.ToList\s*\(\s*\)/, ".ToListAsync()")};`,
  );

  return { changed: optimized !== code, code: optimized };
}

function trySimpleProjectionReorder(code: string): { changed: boolean; code: string } {
  let optimized = code;

  optimized = optimized.replace(
    /(?:var|List<\w+>)\s+(\w+)\s*=\s*await\s+(_context\.\w+)([\s\S]*?)\.ToListAsync\s*\(\s*\)\s*;\s*return\s+\1\.Select\s*\(\s*(\w+)\s*=>\s*new\s+(\w+)\s*\{([\s\S]*?)\}\s*\)\.ToList\s*\(\s*\)/,
    (_match, _varName, ctx, middleChain, alias, dto, body) => {
      const bodyFixed = body.replace(/\.Orders\.Count\b/g, ".Orders.Count()");
      return `return await ${ctx}${middleChain}\n        .Select(${alias} => new ${dto} {${bodyFixed}})\n        .ToListAsync();`;
    },
  );

  optimized = optimized.replace(
    /(\w+)\.Include\s*\(\s*([^)]+)\s*\)\s*\n?\s*\.Where\s*\(\s*([^)]+)\s*\)\s*\n?\s*\.ToListAsync\s*\(\s*\)\s*;\s*\n?\s*return\s+\1\.Select\s*\(\s*(\w+)\s*=>\s*new\s+(\w+)\s*\{([\s\S]*?)\}\s*\)\.ToList\s*\(\s*\)/,
    (_match, ctx, _inc, where, alias, dto, body) =>
      `return await ${ctx}\n        .Where(${where})\n        .Select(${alias} => new ${dto} {${body}})\n        .ToListAsync();`,
  );

  return { changed: optimized !== code, code: optimized };
}

function tryAddAsNoTracking(
  code: string,
  projectStack?: ProjectStack,
): { changed: boolean; code: string } {
  if (/\.AsNoTracking(?:WithIdentityResolution)?\s*\(/.test(code)) {
    return { changed: false, code };
  }

  const useIdentityResolution =
    projectStack &&
    isEfFeatureSupported(
      projectStack.efKind,
      projectStack.efVersion,
      "AsNoTrackingWithIdentityResolution",
    );

  const optimized = code.replace(
    /(_context\.\w+)\s*\n?\s*\./,
    useIdentityResolution
      ? "$1\n        .AsNoTrackingWithIdentityResolution()\n        ."
      : "$1\n        .AsNoTracking()\n        .",
  );

  if (optimized === code) {
    const alt = code.replace(
      /(_context\.\w+)/,
      useIdentityResolution
        ? "$1.AsNoTrackingWithIdentityResolution()"
        : "$1.AsNoTracking()",
    );
    return { changed: alt !== code, code: alt };
  }

  return { changed: true, code: optimized };
}

function tryReplaceCountWithAny(code: string): { changed: boolean; code: string } {
  if (!isBooleanCountContext(code) && !isBooleanCountContext(code, true)) {
    return { changed: false, code };
  }

  let optimized = code;
  let changed = false;

  if (/\.CountAsync\s*\(\s*\)\s*>\s*0/.test(optimized)) {
    optimized = optimized.replace(/\.CountAsync\s*\(\s*\)\s*>\s*0/g, ".AnyAsync()");
    changed = true;
  }

  if (/\.Count\s*\(\s*\)\s*>\s*0/.test(optimized)) {
    optimized = optimized.replace(/\.Count\s*\(\s*\)\s*>\s*0/g, ".Any()");
    changed = true;
  }

  if (/\.CountAsync\s*\(\s*\)\s*==\s*0/.test(optimized)) {
    optimized = optimized.replace(
      /if\s*\(\s*(await\s+[^)]+\.CountAsync\s*\(\s*\))\s*==\s*0\s*\)/g,
      (_match, awaitExpr) => {
        const anyExpr = String(awaitExpr).replace(/\.CountAsync\s*\(\s*\)/, ".AnyAsync()");
        return `if (!(${anyExpr}))`;
      },
    );
    changed = true;
  }

  if (/\.Count\s*\(\s*\)\s*==\s*0/.test(optimized)) {
    optimized = optimized.replace(/\.Count\s*\(\s*\)\s*==\s*0/g, ".Any() == false");
    optimized = optimized.replace(/\.Any\s*\(\s*\)\s*==\s*false/g, "!.Any()");
    changed = true;
  }

  return { changed: changed && optimized !== code, code: optimized };
}

function isBooleanCountContext(code: string, equalsZero = false): boolean {
  const pattern = equalsZero
    ? /\.Count(?:Async)?\s*\(\s*\)\s*==\s*0/
    : /\.Count(?:Async)?\s*\(\s*\)\s*>\s*0/;

  if (!pattern.test(code)) return false;
  if (/return\s+[^;]*\.Count(?:Async)?\s*\(\s*\)\s*;/.test(code)) return false;
  if (/var\s+\w+\s*=\s*[^;]*\.Count(?:Async)?\s*\(\s*\)\s*;/.test(code)) return false;
  return /if\s*\(|return\s+[^;]+\.Count(?:Async)?\s*\(\s*\)\s*[><=!]/.test(code);
}

const HIGH_RISK_TYPES = new Set<QuerySmellType>([
  "EARLY_MATERIALIZATION",
  "DTO_PROJECTION_AFTER_MATERIALIZATION",
  "IN_MEMORY_PAGINATION",
  "MULTIPLE_COLLECTION_INCLUDES",
  "CUSTOM_METHOD_IN_WHERE",
]);

const MEDIUM_RISK_TYPES = new Set<QuerySmellType>([
  "MISSING_AS_NO_TRACKING",
  "FUNCTION_ON_FILTERED_COLUMN",
  "LARGE_CONTAINS_RISK",
  "SKIP_TAKE_WITHOUT_ORDER_BY",
  "UNNECESSARY_INCLUDE_WITH_PROJECTION",
  "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO",
  "GROUP_BY_NAVIGATION_OR_OBJECT",
]);

export function determineRiskLevel(smells: QuerySmell[]): RiskLevel {
  if (smells.length === 0) return "low";
  const types = new Set(smells.map((s) => s.type));
  if ([...types].some((t) => HIGH_RISK_TYPES.has(t))) return "high";
  if ([...types].some((t) => MEDIUM_RISK_TYPES.has(t))) return "medium";
  return "low";
}

export function sortProblemsBySeverity(smells: QuerySmell[]): QuerySmell[] {
  const order: Record<QuerySmell["severity"], number> = { high: 0, medium: 1, low: 2 };
  return [...smells].sort((a, b) => order[a.severity] - order[b.severity]);
}

export function buildSummary(smells: QuerySmell[], mode: OptimizationMode = "strict"): string {
  if (smells.length === 0) {
    return "No significant performance issues detected.";
  }

  const prefix =
    mode === "strict"
      ? "Conservative analysis complete."
      : "Safe-mode analysis complete.";

  const types = new Set(smells.map((s) => s.type));
  if (types.has("DTO_PROJECTION_AFTER_MATERIALIZATION") || types.has("EARLY_MATERIALIZATION")) {
    return `${prefix} The query materializes entities before applying projection and filtering.`;
  }
  if (types.has("MISSING_AS_NO_TRACKING")) {
    return `${prefix} The query appears read-only but does not use AsNoTracking.`;
  }
  return `${prefix} Detected ${smells.length} potential performance issue(s).`;
}

export function buildMarkdownSummary(result: {
  summary: string;
  problems: QuerySmell[];
  recommendedApproach: string;
  needsManualReview: boolean;
  behaviorNotes: string[];
  mode: OptimizationMode;
  rewritePlanCount: number;
}): string {
  const lines = [
    "Summary:",
    result.summary,
    "",
    `Analysis mode: ${result.mode}`,
    "",
    "Main issues:",
    ...sortProblemsBySeverity(result.problems)
      .slice(0, 5)
      .map(
        (p) =>
          `- ${p.type}: ${p.message} (manualReview=${p.needsManualReview}, canAutoFix=${p.canAutoFix})`,
      ),
    "",
    `Rewrite plan items: ${result.rewritePlanCount}`,
    "",
    `Recommended approach: ${result.recommendedApproach}`,
    "",
    "Why:",
    ...result.behaviorNotes.map((n) => `- ${n}`),
    "",
    `Manual review: ${result.needsManualReview ? "Required" : "Not required"}`,
  ];
  return lines.join("\n");
}
