export type OptimizationMode = "strict" | "safe";

export interface RewritePlanItem {
  id: string;
  title: string;
  confidence: "low" | "medium" | "high";
  safeToAutoApply: boolean;
  requiresManualReview: boolean;
  reason: string;
  before: string;
  after: string;
}

export interface RewritePlanResult {
  rewritePlan: RewritePlanItem[];
  optimizedCode?: string;
  needsManualReview: boolean;
  appliedTransformations: string[];
  notes: string[];
}
