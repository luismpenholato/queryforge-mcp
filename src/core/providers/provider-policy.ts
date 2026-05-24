import type { ProjectStack } from "../project-stack/project-stack.types.js";
import type { QuerySmell } from "../query-analysis/query-smell.types.js";

export type AnalysisMode = "standard" | "generic_conservative";

const CONSERVATIVE_NOTE =
  "Conservative generic analysis applied for this provider. Provider-specific behavior was not assumed.";

const INMEMORY_PERFORMANCE_NOTE =
  "InMemory provider does not represent real database query performance. Do not use these findings for production performance decisions.";

export function isDocumentProvider(
  stack: Pick<ProjectStack, "provider" | "providerFamily">,
): boolean {
  return (
    stack.providerFamily === "Document" ||
    stack.provider === "MongoDB" ||
    stack.provider === "Cosmos" ||
    stack.provider === "RavenDB"
  );
}

export function isCustomOrUnknownProvider(
  stack: Pick<ProjectStack, "provider" | "providerFamily"> &
    Partial<Pick<ProjectStack, "providerSupportLevel">>,
): boolean {
  return (
    stack.providerFamily === "Custom" ||
    stack.providerFamily === "Unknown" ||
    stack.provider === "Custom" ||
    stack.provider === "Unknown" ||
    stack.providerSupportLevel === "custom" ||
    stack.providerSupportLevel === "unknown"
  );
}

export function isInMemoryProvider(
  stack: Pick<ProjectStack, "provider" | "providerFamily">,
): boolean {
  return stack.provider === "InMemory" || stack.providerFamily === "InMemory";
}

export function getAnalysisMode(
  stack?: Pick<ProjectStack, "provider" | "providerFamily">,
): AnalysisMode {
  if (!stack) return "standard";
  if (
    isDocumentProvider(stack) ||
    isCustomOrUnknownProvider(stack) ||
    isInMemoryProvider(stack)
  ) {
    return "generic_conservative";
  }
  return "standard";
}

export function requiresConservativeAnalysis(
  stack?: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): boolean {
  return getAnalysisMode(stack) === "generic_conservative";
}

export function shouldBlockDapperSuggestion(
  stack: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): boolean {
  return (
    isDocumentProvider(stack) ||
    isCustomOrUnknownProvider(stack) ||
    isInMemoryProvider(stack)
  );
}

export function shouldBlockSpecificSql(
  stack: Pick<ProjectStack, "provider" | "providerFamily">,
): boolean {
  return isDocumentProvider(stack) || isCustomOrUnknownProvider(stack);
}

export function shouldBlockIndexSuggestions(
  stack: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): boolean {
  return isCustomOrUnknownProvider(stack) || isInMemoryProvider(stack);
}

export function shouldBlockCreateIndexSql(
  stack: Pick<ProjectStack, "provider" | "providerFamily">,
): boolean {
  return isDocumentProvider(stack) || isCustomOrUnknownProvider(stack) || isInMemoryProvider(stack);
}

export function getConservativeAnalysisNotes(
  stack: Pick<ProjectStack, "provider" | "providerFamily">,
): string[] {
  const notes: string[] = [];

  if (isDocumentProvider(stack)) {
    notes.push(CONSERVATIVE_NOTE);
    notes.push("Document provider detected: SQL-style JOIN, CREATE INDEX SQL, and Dapper are not suggested.");
    notes.push("Include/navigation is interpreted as document embedding, not a relational join.");
  }

  if (isCustomOrUnknownProvider(stack)) {
    notes.push(CONSERVATIVE_NOTE);
    notes.push("Only generic LINQ/EF analysis applied. No provider-specific SQL, Dapper, or indexes.");
  }

  if (isInMemoryProvider(stack)) {
    notes.push(INMEMORY_PERFORMANCE_NOTE);
    notes.push(CONSERVATIVE_NOTE);
  }

  return notes;
}

const RELATIONAL_INCLUDE_SMELL_TYPES = new Set<QuerySmell["type"]>([
  "MULTIPLE_COLLECTION_INCLUDES",
  "UNNECESSARY_INCLUDE_WITH_PROJECTION",
  "INCLUDE_FOR_DTO_ONLY",
]);

const RELATIONAL_INDEX_SMELL_TYPES = new Set<QuerySmell["type"]>([
  "LIKE_WITHOUT_INDEX",
]);

const RELATIONAL_SQL_SMELL_TYPES = new Set<QuerySmell["type"]>([
  "LARGE_CONTAINS_RISK",
]);

export function applyProviderSmellPolicy(
  smells: QuerySmell[],
  stack?: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): QuerySmell[] {
  if (!stack) return smells;

  let result = [...smells];

  if (isDocumentProvider(stack)) {
    result = result
      .filter((s) => s.type !== "MULTIPLE_COLLECTION_INCLUDES")
      .map((s) => adaptSmellForDocumentProvider(s));
  }

  if (isCustomOrUnknownProvider(stack)) {
    result = result.map((s) => adaptSmellForGenericProvider(s));
  }

  if (isInMemoryProvider(stack)) {
    result = result.map((s) => adaptSmellForInMemoryProvider(s));
  }

  return dedupeSmells(result);
}

function adaptSmellForDocumentProvider(smell: QuerySmell): QuerySmell {
  if (RELATIONAL_INCLUDE_SMELL_TYPES.has(smell.type)) {
    return {
      ...smell,
      message: "Navigation/embedded data loading detected via Include or related APIs.",
      impact: "On document providers, nested data loading uses embedding/navigation, not SQL-style joins.",
      suggestion:
        "Review document embedding, explicit projection, or provider-specific loading patterns.",
    };
  }

  if (RELATIONAL_INDEX_SMELL_TYPES.has(smell.type)) {
    return {
      ...smell,
      message: "String filter pattern may be expensive on document fields.",
      impact: "Document index behavior differs from relational indexes.",
      suggestion: "Review document field filters and validate with the provider explain plan.",
    };
  }

  if (RELATIONAL_SQL_SMELL_TYPES.has(smell.type)) {
    return {
      ...smell,
      message: smell.message,
      impact: "Large filter lists may affect document query performance.",
      suggestion: "Consider smaller batches or a document-native filtering strategy.",
    };
  }

  if (smell.message.includes("SQL") || smell.suggestion.includes("TVP") || smell.suggestion.includes("temp table")) {
    return adaptSmellForGenericProvider(smell);
  }

  return smell;
}

function adaptSmellForGenericProvider(smell: QuerySmell): QuerySmell {
  let { message, impact, suggestion } = smell;

  message = message
    .replace(/relational join/gi, "navigation loading")
    .replace(/generated SQL/gi, "provider translation")
    .replace(/CREATE INDEX/gi, "index strategy");

  impact = impact
    .replace(/index usage/gi, "query efficiency")
    .replace(/cartesian explosion/gi, " excessive data loading")
    .replace(/IN clauses/gi, "large filter lists");

  suggestion = suggestion
    .replace(/TVP|temp table|split quer(y|ies)/gi, "a manual review strategy")
    .replace(/execution plan/gi, "provider-specific diagnostics")
    .replace(/JOIN/gi, "navigation loading");

  if (smell.type === "CUSTOM_METHOD_IN_WHERE") {
    suggestion = "Ensure the predicate can be translated by the EF provider.";
  }

  return { ...smell, message, impact, suggestion };
}

function adaptSmellForInMemoryProvider(smell: QuerySmell): QuerySmell {
  const adapted = adaptSmellForGenericProvider(smell);
  return {
    ...adapted,
    impact: `${adapted.impact} (InMemory results are not representative of production database performance.)`,
  };
}

function dedupeSmells(smells: QuerySmell[]): QuerySmell[] {
  const seen = new Set<string>();
  return smells.filter((s) => {
    const key = `${s.type}:${s.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shouldSkipRelationalOptimizations(
  stack?: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): boolean {
  return requiresConservativeAnalysis(stack);
}

export function shouldSkipIncludeRemoval(
  stack?: Pick<ProjectStack, "provider" | "providerFamily" | "providerSupportLevel">,
): boolean {
  return requiresConservativeAnalysis(stack);
}

export {
  CONSERVATIVE_NOTE,
  INMEMORY_PERFORMANCE_NOTE,
};
