import type { LinqPattern } from "./query-analysis.types.js";
import type { QuerySmell, QuerySmellType } from "./query-smell.types.js";
import {
  detectPostQueryNavigationUse,
  detectTrackingRisk,
  hasEntityMutationAfterLoad,
  isReadOnlyQuery,
} from "./linq-pattern-analyzer.js";
import {
  hasBehaviorSensitiveConstructs,
  isSimpleMaterializationChain,
} from "./query-complexity-analyzer.js";

interface EnrichContext {
  code: string;
  pattern: LinqPattern;
  hasTrackingRisk: boolean;
  isReadOnly: boolean;
}

export function enrichQuerySmells(
  code: string,
  pattern: LinqPattern,
  smells: QuerySmell[],
  context: { hasTrackingRisk: boolean; isReadOnly: boolean },
): QuerySmell[] {
  const ctx: EnrichContext = { code, pattern, ...context };
  return smells.map((smell) => enrichSingleSmell(smell, ctx));
}

function enrichSingleSmell(smell: QuerySmell, ctx: EnrichContext): QuerySmell {
  const base = {
    ...smell,
    confidence: smell.confidence ?? defaultConfidence(smell.type, smell.severity),
    needsManualReview: smell.needsManualReview ?? true,
    canAutoFix: smell.canAutoFix ?? false,
  };

  switch (smell.type) {
    case "EARLY_MATERIALIZATION":
    case "DTO_PROJECTION_AFTER_MATERIALIZATION":
    case "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO":
      return enrichMaterializationSmell(base, ctx);
    case "MISSING_AS_NO_TRACKING":
      return enrichAsNoTrackingSmell(base, ctx);
    case "UNNECESSARY_INCLUDE_WITH_PROJECTION":
      return enrichIncludeProjectionSmell(base, ctx);
    case "MULTIPLE_COLLECTION_INCLUDES":
      return {
        ...base,
        confidence: "medium",
        canAutoFix: false,
        needsManualReview: true,
      };
    case "IN_MEMORY_PAGINATION":
      return enrichInMemoryPaginationSmell(base, ctx);
    case "LARGE_CONTAINS_RISK":
      return {
        ...base,
        confidence: "low",
        canAutoFix: false,
        needsManualReview: true,
      };
    case "FUNCTION_ON_FILTERED_COLUMN":
      return {
        ...base,
        confidence: "low",
        canAutoFix: false,
        needsManualReview: true,
      };
    case "CUSTOM_METHOD_IN_WHERE":
      return {
        ...base,
        confidence: "low",
        canAutoFix: false,
        needsManualReview: true,
      };
    case "GROUP_BY_NAVIGATION_OR_OBJECT":
      return {
        ...base,
        confidence: "low",
        canAutoFix: false,
        needsManualReview: true,
      };
    case "FIRST_OR_DEFAULT_WITHOUT_ORDER":
      return {
        ...base,
        confidence: "low",
        canAutoFix: false,
        needsManualReview: true,
      };
    case "COUNT_GREATER_THAN_ZERO":
      return {
        ...base,
        confidence: "high",
        canAutoFix: true,
        needsManualReview: false,
        safeFix: "Replace Count()/CountAsync() existence checks with Any()/AnyAsync().",
      };
    case "SKIP_TAKE_WITHOUT_ORDER_BY":
      return {
        ...base,
        confidence: "low",
        canAutoFix: false,
        needsManualReview: true,
      };
    default:
      return {
        ...base,
        needsManualReview: base.severity !== "low" || base.needsManualReview,
        canAutoFix: false,
      };
  }
}

function enrichMaterializationSmell(smell: QuerySmell, ctx: EnrichContext): QuerySmell {
  const simple = isSimpleMaterializationChain(ctx.code, ctx.pattern);
  const postVarUse = !!ctx.pattern.postMaterializationVariable;
  const navigationInvolved = hasBehaviorSensitiveConstructs(ctx.code);

  return {
    ...smell,
    confidence: simple && !navigationInvolved ? "medium" : "low",
    canAutoFix: simple && !postVarUse,
    needsManualReview: !simple || postVarUse || navigationInvolved,
    safeFix: simple
      ? "Move filters/projection before ToListAsync in a single fluent chain."
      : undefined,
  };
}

function enrichAsNoTrackingSmell(smell: QuerySmell, ctx: EnrichContext): QuerySmell {
  const readOnlyHighConfidence =
    ctx.isReadOnly &&
    !ctx.hasTrackingRisk &&
    !detectTrackingRisk(ctx.code) &&
    !hasEntityMutationAfterLoad(ctx.code) &&
    isReadOnlyQuery(ctx.code, ctx.pattern);

  return {
    ...smell,
    confidence: readOnlyHighConfidence ? "high" : "low",
    canAutoFix: readOnlyHighConfidence,
    needsManualReview: !readOnlyHighConfidence,
    safeFix: readOnlyHighConfidence
      ? "Add AsNoTracking() because no SaveChanges, Attach, Entry, or entity mutation was detected."
      : undefined,
  };
}

function enrichIncludeProjectionSmell(smell: QuerySmell, ctx: EnrichContext): QuerySmell {
  const navDoubt =
    detectPostQueryNavigationUse(ctx.code) ||
    ctx.pattern.hasPostQueryNavigationUse ||
    ctx.pattern.returnsEntity;

  return {
    ...smell,
    confidence: "low",
    canAutoFix: false,
    needsManualReview: true,
    safeFix: navDoubt
      ? undefined
      : "Review whether Include can be removed when Select already projects navigation fields.",
  };
}

function enrichInMemoryPaginationSmell(smell: QuerySmell, ctx: EnrichContext): QuerySmell {
  const simple =
    isSimpleMaterializationChain(ctx.code, ctx.pattern) &&
    !ctx.pattern.hasPostQueryNavigationUse;

  return {
    ...smell,
    confidence: simple ? "medium" : "low",
    canAutoFix: simple,
    needsManualReview: !simple,
    safeFix: simple
      ? "Apply OrderBy/Skip/Take before ToListAsync."
      : undefined,
  };
}

function defaultConfidence(
  type: QuerySmellType,
  severity: QuerySmell["severity"],
): QuerySmell["confidence"] {
  if (type === "COUNT_GREATER_THAN_ZERO") return "high";
  if (severity === "high") return "low";
  if (severity === "medium") return "medium";
  return "low";
}
