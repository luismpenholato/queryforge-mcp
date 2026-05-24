import type { QuerySmell } from "../query-analysis/query-smell.types.js";
import type { Confidence } from "../query-analysis/query-analysis.types.js";
import type { RewritePlanItem } from "./rewrite-plan.types.js";
import { hasBehaviorSensitiveConstructs } from "../query-analysis/query-complexity-analyzer.js";

export type BehaviorRisk = "none" | "low" | "medium" | "high";

export function computeBehaviorRisk(
  smells: QuerySmell[],
  rewritePlan: RewritePlanItem[],
  code: string,
): BehaviorRisk {
  if (smells.length === 0 && rewritePlan.length === 0) {
    return "none";
  }

  if (hasHighBehaviorRiskConstructs(code, rewritePlan)) {
    return "high";
  }

  if (smells.some((s) => s.needsManualReview && s.severity === "high")) {
    return "high";
  }

  if (smells.some((s) => s.needsManualReview)) {
    return "medium";
  }

  const onlyLowRiskAutoFixes =
    rewritePlan.length > 0 &&
    rewritePlan.every(
      (item) =>
        item.confidence === "high" &&
        item.safeToAutoApply &&
        !item.requiresManualReview &&
        (item.id === "add-as-no-tracking" || item.id === "count-to-any"),
    );

  if (onlyLowRiskAutoFixes) {
    return "low";
  }

  if (
    rewritePlan.some(
      (item) =>
        item.id === "move-select-before-materialization" ||
        item.id === "move-where-before-materialization" ||
        item.id === "move-pagination-before-materialization",
    )
  ) {
    return hasBehaviorSensitiveConstructs(code) ? "medium" : "low";
  }

  if (rewritePlan.length === 0) {
    return smells.some((s) => s.severity === "low") ? "low" : "medium";
  }

  return "medium";
}

export function computeBehaviorConfidence(
  behaviorRisk: BehaviorRisk,
  needsManualReview: boolean,
): Confidence {
  if (behaviorRisk === "none") return "high";
  if (behaviorRisk === "low" && !needsManualReview) return "high";
  if (behaviorRisk === "low" || behaviorRisk === "medium") return "medium";
  return "low";
}

function hasHighBehaviorRiskConstructs(code: string, rewritePlan: RewritePlanItem[]): boolean {
  if (/\.Include\s*\(|\.ThenInclude\s*\(/.test(code) && rewritePlan.some((p) => p.id.includes("include"))) {
    return true;
  }

  return (
    /\.GroupBy\s*\(/.test(code) ||
    /\.FirstOrDefault(?:Async)?\s*\(/.test(code) ||
    /\.Join\s*\(|\.GroupJoin\s*\(|\.DefaultIfEmpty\s*\(/.test(code) ||
    rewritePlan.some((p) => p.requiresManualReview && p.confidence !== "high")
  );
}
