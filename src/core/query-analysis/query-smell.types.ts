export type QuerySmellType =
  | "EARLY_MATERIALIZATION"
  | "MISSING_AS_NO_TRACKING"
  | "UNNECESSARY_INCLUDE_WITH_PROJECTION"
  | "MULTIPLE_COLLECTION_INCLUDES"
  | "IN_MEMORY_PAGINATION"
  | "IN_MEMORY_COUNT"
  | "COUNT_GREATER_THAN_ZERO"
  | "LARGE_CONTAINS_RISK"
  | "SKIP_TAKE_WITHOUT_ORDER_BY"
  | "FIRST_OR_DEFAULT_WITHOUT_ORDER"
  | "CUSTOM_METHOD_IN_WHERE"
  | "FUNCTION_ON_FILTERED_COLUMN"
  | "CLIENT_EVALUATION_RISK"
  | "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO"
  | "INCLUDE_FOR_DTO_ONLY"
  | "LAZY_LOADING_N_PLUS_ONE"
  | "ORDER_BY_AFTER_MATERIALIZATION"
  | "WHERE_AFTER_SELECT"
  | "LIKE_WITHOUT_INDEX"
  | "MISSING_PAGINATION"
  | "DTO_PROJECTION_AFTER_MATERIALIZATION"
  | "GROUP_BY_NAVIGATION_OR_OBJECT";

export type SmellSeverity = "low" | "medium" | "high";
export type SmellConfidence = "low" | "medium" | "high";

export interface QuerySmell {
  type: QuerySmellType;
  severity: SmellSeverity;
  confidence: SmellConfidence;
  needsManualReview: boolean;
  canAutoFix: boolean;
  message: string;
  impact: string;
  suggestion: string;
  evidence?: string;
  safeFix?: string;
}
