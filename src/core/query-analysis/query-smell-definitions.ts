import type { QuerySmellType } from "./query-smell.types.js";

export interface QuerySmellDefinition {
  type: QuerySmellType;
  defaultSeverity: "low" | "medium" | "high";
  description: string;
}

export const QUERY_SMELL_DEFINITIONS: QuerySmellDefinition[] = [
  {
    type: "EARLY_MATERIALIZATION",
    defaultSeverity: "high",
    description: "Query materializes data before filtering or projecting.",
  },
  {
    type: "DTO_PROJECTION_AFTER_MATERIALIZATION",
    defaultSeverity: "high",
    description: "DTO projection happens after ToList/ToArray.",
  },
  {
    type: "MISSING_AS_NO_TRACKING",
    defaultSeverity: "medium",
    description: "Read-only query without AsNoTracking.",
  },
  {
    type: "UNNECESSARY_INCLUDE_WITH_PROJECTION",
    defaultSeverity: "medium",
    description: "Include is redundant when projection handles navigation.",
  },
  {
    type: "MULTIPLE_COLLECTION_INCLUDES",
    defaultSeverity: "medium",
    description: "Multiple collection Includes may cause cartesian explosion.",
  },
  {
    type: "IN_MEMORY_PAGINATION",
    defaultSeverity: "high",
    description: "Pagination applied after materialization.",
  },
  {
    type: "SKIP_TAKE_WITHOUT_ORDER_BY",
    defaultSeverity: "medium",
    description: "Skip/Take without OrderBy may produce non-deterministic results.",
  },
  {
    type: "COUNT_GREATER_THAN_ZERO",
    defaultSeverity: "low",
    description: "Count used where Any would suffice for boolean check.",
  },
  {
    type: "LARGE_CONTAINS_RISK",
    defaultSeverity: "medium",
    description: "Contains with a potentially large ID list.",
  },
  {
    type: "FUNCTION_ON_FILTERED_COLUMN",
    defaultSeverity: "medium",
    description: "Function applied to filtered column may prevent index usage.",
  },
  {
    type: "CUSTOM_METHOD_IN_WHERE",
    defaultSeverity: "high",
    description: "Custom method in Where may not translate to SQL.",
  },
  {
    type: "GROUP_BY_NAVIGATION_OR_OBJECT",
    defaultSeverity: "medium",
    description: "GroupBy with navigation or complex object key.",
  },
  {
    type: "FIRST_OR_DEFAULT_WITHOUT_ORDER",
    defaultSeverity: "low",
    description: "FirstOrDefault without OrderBy when filter is present.",
  },
  {
    type: "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO",
    defaultSeverity: "medium",
    description: "Full entity load before DTO conversion.",
  },
];
