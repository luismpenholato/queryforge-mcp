import type { QuerySmell } from "../query-analysis/query-smell.types.js";
import type {
  BehaviorPreservation,
  DapperAlternativeSummary,
  RecommendedApproach,
  RiskLevel,
} from "../query-analysis/query-analysis.types.js";
import type { IndexSuggestion } from "../indexes/index-suggestion.types.js";
import type { OptimizationMode, RewritePlanItem } from "./rewrite-plan.types.js";

export interface OptimizationResult {
  summary: string;
  riskLevel: RiskLevel;
  recommendedApproach: RecommendedApproach;
  mode: OptimizationMode;
  behaviorPreservation: BehaviorPreservation;
  problems: QuerySmell[];
  rewritePlan: RewritePlanItem[];
  optimizedEfCode?: string | null;
  dapperAlternative: DapperAlternativeSummary;
  indexSuggestions: IndexSuggestion[];
  versionNotes: string[];
  needsManualReview: boolean;
  analysisMode?: "standard" | "generic_conservative";
  markdownSummary?: string;
}

export interface DapperAlternative extends DapperAlternativeSummary {
  hasDapper: boolean;
  sql?: string;
  csharpCode?: string;
  parameters?: DapperParameter[];
  warnings: string[];
  needsManualReview: boolean;
}

export interface DapperParameter {
  name: string;
  source: string;
  type: string;
}

export interface CompareResult {
  recommendation: RecommendedApproach;
  confidence: "low" | "medium" | "high";
  efOptimized: {
    score: number;
    pros: string[];
    cons: string[];
  };
  dapper: {
    score: number;
    pros: string[];
    cons: string[];
    requiresNewDependency: boolean;
  };
  decisionReason: string;
}
