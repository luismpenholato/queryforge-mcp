import type { QuerySmell } from "./query-smell.types.js";

export type RiskLevel = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

export type RecommendedApproach =
  | "EF_OPTIMIZED"
  | "DAPPER"
  | "KEEP_CURRENT_WITH_INDEX"
  | "MANUAL_REVIEW"
  | "NO_CHANGE_NEEDED";

export type BehaviorRisk = "none" | "low" | "medium" | "high";

export interface BehaviorPreservation {
  preserved: boolean;
  confidence: Confidence;
  behaviorRisk: BehaviorRisk;
  notes: string[];
}

export interface DapperAlternativeSummary {
  available: boolean;
  recommended: boolean;
  requiresNewDependency: boolean;
  reason: string;
}

export interface LinqPattern {
  hasToListBeforeWhere: boolean;
  hasToListBeforeSelect: boolean;
  hasToListBeforeSkipTake: boolean;
  hasToListBeforeOrderBy: boolean;
  hasToListBeforeGroupBy: boolean;
  hasAsNoTracking: boolean;
  hasInclude: boolean;
  hasSelect: boolean;
  hasWhere: boolean;
  hasSkipTake: boolean;
  hasOrderBy: boolean;
  hasDtoProjection: boolean;
  appearsReadOnly: boolean;
  returnsEntity: boolean;
  materializationIndex: number;
  callOrder: string[];
  postMaterializationVariable?: string;
  hasPostQueryNavigationUse: boolean;
}

export interface QueryAnalysis {
  smells: QuerySmell[];
  linqPattern: LinqPattern;
  isReadOnly: boolean;
  hasTrackingRisk: boolean;
  analysisMode?: "standard" | "generic_conservative";
}
