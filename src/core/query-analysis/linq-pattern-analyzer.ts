import type { LinqPattern } from "./query-analysis.types.js";
import type { QuerySmell } from "./query-smell.types.js";
import { extractMethodCalls, indexOfCall } from "../../shared/text/text-utils.js";

const MATERIALIZATION_CALLS = ["ToList", "ToArray", "AsEnumerable"];
const CHAIN_OPS_BEFORE_MAT = ["Where", "Select", "Skip", "Take", "OrderBy", "OrderByDescending", "GroupBy"];

export function analyzeLinqPattern(code: string): LinqPattern {
  const callOrder = extractMethodCalls(code);
  const normalized = code.replace(/\s+/g, " ");

  const toListIndex = firstMaterializationIndex(normalized);
  const whereIndex = indexOfCall(normalized, "Where");
  const selectIndex = indexOfCall(normalized, "Select");
  const skipIndex = Math.min(
    indexOfCall(normalized, "Skip") === -1 ? Infinity : indexOfCall(normalized, "Skip"),
    indexOfCall(normalized, "Take") === -1 ? Infinity : indexOfCall(normalized, "Take"),
  );
  const orderByIndex = Math.min(
    indexOfCall(normalized, "OrderBy") === -1 ? Infinity : indexOfCall(normalized, "OrderBy"),
    indexOfCall(normalized, "OrderByDescending") === -1
      ? Infinity
      : indexOfCall(normalized, "OrderByDescending"),
  );
  const groupByIndex = indexOfCall(normalized, "GroupBy");

  const hasDtoProjection = /new\s+\w+(Dto|DTO|ViewModel|Response)\s*\{/.test(code);
  const hasInclude = /\.Include\s*\(/.test(code);
  const hasAsNoTracking = /\.AsNoTracking(?:WithIdentityResolution)?\s*\(/.test(code);
  const hasOrderBy = orderByIndex !== Infinity;
  const hasSkipTake = /\.Skip\s*\(|\.Take\s*\(/.test(code);
  const readOnly = appearsReadOnly(code);
  const returnsEntity = detectReturnsEntity(code, hasInclude, hasDtoProjection);
  const postMaterialization = detectPostMaterializationOps(code);

  return {
    hasToListBeforeWhere:
      (toListIndex !== -1 && whereIndex !== -1 && toListIndex < whereIndex) ||
      postMaterialization.hasWhere,
    hasToListBeforeSelect:
      (toListIndex !== -1 && selectIndex !== -1 && toListIndex < selectIndex) ||
      postMaterialization.hasSelect,
    hasToListBeforeSkipTake:
      (toListIndex !== -1 && skipIndex !== Infinity && toListIndex < skipIndex) ||
      postMaterialization.hasSkipTake,
    hasToListBeforeOrderBy: toListIndex !== -1 && orderByIndex !== Infinity && toListIndex < orderByIndex,
    hasToListBeforeGroupBy:
      (toListIndex !== -1 && groupByIndex !== -1 && toListIndex < groupByIndex) ||
      postMaterialization.hasGroupBy,
    hasAsNoTracking,
    hasInclude,
    hasSelect: selectIndex !== -1 || postMaterialization.hasSelect,
    hasWhere: whereIndex !== -1 || postMaterialization.hasWhere,
    hasSkipTake: hasSkipTake || postMaterialization.hasSkipTake,
    hasOrderBy,
    hasDtoProjection: hasDtoProjection || postMaterialization.hasDtoSelect,
    appearsReadOnly: readOnly,
    returnsEntity,
    materializationIndex: toListIndex,
    callOrder,
    postMaterializationVariable: postMaterialization.variableName,
    hasPostQueryNavigationUse: detectPostQueryNavigationUse(code),
  };
}

function firstMaterializationIndex(code: string): number {
  let earliest = -1;
  for (const call of MATERIALIZATION_CALLS) {
    const idx = indexOfCall(code, call);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }
  return earliest;
}

function detectReturnsEntity(code: string, hasInclude: boolean, hasDtoProjection: boolean): boolean {
  if (hasDtoProjection && /\.Select\s*\(\s*\w+\s*=>\s*new\s+\w+(Dto|DTO|ViewModel|Response)/.test(code)) {
    return false;
  }
  if (/return\s+await\s+[\s\S]*?\.Select\s*\(\s*\w+\s*=>\s*new\s+\w+(Dto|DTO|ViewModel|Response)/.test(code)) {
    return false;
  }
  if (/Task<List<\w+Dto>|Task<List<\w+DTO>|IEnumerable<\w+Dto>/.test(code)) {
    return false;
  }
  return hasInclude || /\.ToListAsync\s*\(\s*\)\s*;[\s\S]*?return\s+\w+\s*;/.test(code);
}

export function appearsReadOnly(code: string): boolean {
  const writePatterns = [
    /\.SaveChanges(?:Async)?\s*\(/,
    /\.Add(?:Async)?\s*\(/,
    /\.Update(?:Async)?\s*\(/,
    /\.Remove(?:Async)?\s*\(/,
    /\.Attach\s*\(/,
    /\.Entry\s*\(/,
    /\.State\s*=/,
  ];
  return !writePatterns.some((p) => p.test(code));
}

export function isReadOnlyQuery(code: string, pattern: LinqPattern): boolean {
  if (detectTrackingRisk(code) || hasEntityMutationAfterLoad(code)) {
    return false;
  }
  if (!pattern.appearsReadOnly) {
    return false;
  }
  return (
    pattern.hasDtoProjection ||
    /Task<(?:List|IEnumerable|IReadOnlyList)/.test(code) ||
    /\.Select\s*\(\s*\w+\s*=>\s*new\s+\w+(Dto|DTO|ViewModel|Response)/.test(code) ||
    /\.(ToList|First|Single|Any|Count)(?:Async)?\s*\(/.test(code)
  );
}

export function detectTrackingRisk(code: string): boolean {
  return /\.SaveChanges|\.Update\s*\(|\.Add\s*\(|\.Attach\s*\(|\.Entry\s*\(|\.Remove\s*\(/.test(code);
}

export function hasEntityMutationAfterLoad(code: string): boolean {
  const materializedVars = [
    ...code.matchAll(/(?:var|List<\w+>)\s+(\w+)\s*=\s*await\s+[\s\S]*?\.(?:ToList|First|Single)(?:Async)?\s*\(/g),
  ];
  for (const match of materializedVars) {
    const varName = match[1];
    const afterAssign = code.slice(match.index! + match[0].length);
    if (new RegExp(`\\b${varName}\\.\\w+\\s*=`).test(afterAssign)) {
      return true;
    }
  }
  return false;
}

function detectPostMaterializationOps(code: string): {
  variableName?: string;
  hasWhere: boolean;
  hasSelect: boolean;
  hasSkipTake: boolean;
  hasOrderBy: boolean;
  hasGroupBy: boolean;
  hasDtoSelect: boolean;
} {
  const assignMatch = code.match(
    /(?:var|List<\w+>)\s+(\w+)\s*=\s*await\s+[\s\S]*?\.(?:ToList|ToArray|AsEnumerable)(?:Async)?\s*\(\s*\)\s*;/,
  );
  if (!assignMatch) {
    return {
      hasWhere: false,
      hasSelect: false,
      hasSkipTake: false,
      hasOrderBy: false,
      hasGroupBy: false,
      hasDtoSelect: false,
    };
  }

  const varName = assignMatch[1];
  const afterAssign = code.slice(assignMatch.index! + assignMatch[0].length);
  const varPattern = new RegExp(`\\b${varName}\\.`);

  return {
    variableName: varName,
    hasWhere: varPattern.test(afterAssign) && /\.Where\s*\(/.test(afterAssign),
    hasSelect: varPattern.test(afterAssign) && /\.Select\s*\(/.test(afterAssign),
    hasSkipTake: varPattern.test(afterAssign) && /\.(?:Skip|Take)\s*\(/.test(afterAssign),
    hasOrderBy: varPattern.test(afterAssign) && /\.OrderBy(?:Descending)?\s*\(/.test(afterAssign),
    hasGroupBy: varPattern.test(afterAssign) && /\.GroupBy\s*\(/.test(afterAssign),
    hasDtoSelect: new RegExp(
      `\\b${varName}\\.Select\\s*\\([\\s\\S]*?new\\s+\\w+(Dto|DTO|ViewModel|Response)`,
    ).test(afterAssign),
  };
}

export function detectPostQueryNavigationUse(code: string): boolean {
  if (!/\.Include\s*\(/.test(code)) {
    return false;
  }
  const includeMatch = code.match(/\.Include\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/);
  if (!includeMatch) {
    return false;
  }
  const navProp = includeMatch[1];
  const afterMaterialization = code.split(/\.(?:ToList|First|Single)(?:Async)?\s*\(\s*\)/)[1];
  if (!afterMaterialization) {
    return false;
  }
  return new RegExp(`\\.${navProp}\\.`).test(afterMaterialization);
}

export function analyzeLinqForSmells(code: string): QuerySmell[] {
  const pattern = analyzeLinqPattern(code);
  const smells: SmellDraft[] = [];
  const normalized = code.replace(/\s+/g, " ");

  detectEarlyMaterializationSmells(normalized, pattern, smells);
  detectReadOnlyTrackingSmells(code, pattern, smells);
  detectIncludeSmells(code, pattern, smells);
  detectPaginationSmells(pattern, smells);
  detectCountSmells(code, smells);
  detectContainsSmells(code, smells);
  detectFilterFunctionSmells(code, smells);
  detectCustomMethodSmells(code, smells);
  detectGroupBySmells(code, smells);
  detectFirstOrDefaultSmells(code, normalized, smells);
  detectEntityLoadForDtoSmells(code, pattern, smells);

  return dedupeSmells(smells.map(toBaseSmell));
}

type SmellDraft = Omit<QuerySmell, "confidence" | "needsManualReview" | "canAutoFix">;

function toBaseSmell(draft: SmellDraft): QuerySmell {
  return {
    confidence: "medium",
    needsManualReview: true,
    canAutoFix: false,
    ...draft,
  };
}

function detectEarlyMaterializationSmells(
  normalized: string,
  pattern: LinqPattern,
  smells: SmellDraft[],
): void {
  const matIndex = firstMaterializationIndex(normalized);
  const chainOpsHit = CHAIN_OPS_BEFORE_MAT.filter((op) => {
    const idx = indexOfCall(normalized, op);
    return matIndex !== -1 && idx !== -1 && matIndex < idx;
  });

  const postMatHit = [
    pattern.hasToListBeforeWhere && "Where",
    pattern.hasToListBeforeSelect && "Select",
    pattern.hasToListBeforeSkipTake && "Skip/Take",
    pattern.hasToListBeforeOrderBy && "OrderBy",
    pattern.hasToListBeforeGroupBy && "GroupBy",
  ].filter(Boolean);

  if (chainOpsHit.length > 0 || postMatHit.length > 0) {
    const ops = [...new Set([...chainOpsHit, ...postMatHit.map(String)])];
    smells.push({
      type: "EARLY_MATERIALIZATION",
      severity: "high",
      message: `Materialization (ToList/ToArray/AsEnumerable) occurs before ${ops.join(", ")}.`,
      impact: "Pulls more data into memory than necessary and may prevent server-side translation.",
      suggestion: "Keep IQueryable until filters/projection are applied; materialize only at the end.",
      evidence: `Materialization before: ${ops.join(", ")}.`,
    });
  }

  if (pattern.hasDtoProjection && (pattern.hasToListBeforeSelect || pattern.postMaterializationVariable)) {
    smells.push({
      type: "DTO_PROJECTION_AFTER_MATERIALIZATION",
      severity: "high",
      message: "DTO projection happens after ToList/ToArray materialization.",
      impact: "Loads full entities when only DTO fields are needed.",
      suggestion: "Move Select projection before ToListAsync when behavior is equivalent.",
      evidence: pattern.postMaterializationVariable
        ? `Variable ${pattern.postMaterializationVariable} materialized before Select.`
        : "Select occurs after materialization in the fluent chain.",
    });
  }
}

function detectReadOnlyTrackingSmells(code: string, pattern: LinqPattern, smells: SmellDraft[]): void {
  if (
    isReadOnlyQuery(code, pattern) &&
    !pattern.hasAsNoTracking &&
    /\.(?:ToList|First|Single|Any|Count)(?:Async)?\s*\(/.test(code)
  ) {
    smells.push({
      type: "MISSING_AS_NO_TRACKING",
      severity: "medium",
      message: "Read-only query without AsNoTracking.",
      impact: "EF tracks entities unnecessarily, increasing memory usage.",
      suggestion: "Add AsNoTracking() for read-only queries that do not update entities afterward.",
    });
  }
}

function detectIncludeSmells(code: string, pattern: LinqPattern, smells: SmellDraft[]): void {
  if (pattern.hasInclude && pattern.hasDtoProjection && !pattern.returnsEntity) {
    smells.push({
      type: "UNNECESSARY_INCLUDE_WITH_PROJECTION",
      severity: "medium",
      message: "Include used together with Select to DTO when projection already accesses navigation.",
      impact: "Eager loading may fetch more data than needed when projection handles navigation in SQL.",
      suggestion:
        "In EF relational providers, Include is usually unnecessary when Select projects navigation properties directly.",
      evidence: pattern.hasPostQueryNavigationUse
        ? "Navigation may be used after materialization — review before removing Include."
        : undefined,
    });
  }

  const collectionIncludes = countCollectionIncludes(code);
  if (collectionIncludes >= 2) {
    smells.push({
      type: "MULTIPLE_COLLECTION_INCLUDES",
      severity: "medium",
      message: "Multiple collection Includes detected (cartesian explosion risk).",
      impact: "Multiple collection eager loads may produce a large cartesian product in SQL.",
      suggestion:
        "Review whether all collection Includes are required; consider projection or split loading when supported.",
      evidence: `${collectionIncludes} collection Include(s) detected.`,
    });
  } else {
    const includeCount = (code.match(/\.Include\s*\(/g) ?? []).length;
    const thenIncludeCount = (code.match(/\.ThenInclude\s*\(/g) ?? []).length;
    if (includeCount + thenIncludeCount >= 3) {
      smells.push({
        type: "MULTIPLE_COLLECTION_INCLUDES",
        severity: "medium",
        message: "Multiple Include/ThenInclude calls detected.",
        impact: "May cause excessive data loading or cartesian explosion in generated SQL.",
        suggestion:
          "Review whether all Includes are required; consider projection or split loading when supported.",
        evidence: `${includeCount + thenIncludeCount} Include/ThenInclude call(s) detected.`,
      });
    }
  }
}

function countCollectionIncludes(code: string): number {
  const includeRegex = /\.Include\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/g;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = includeRegex.exec(code)) !== null) {
    const prop = match[1];
    if (/s$|Items|Itens|Pagamentos|Anexos|Orders|Details|Children|Lines/i.test(prop)) {
      count++;
    }
  }
  return count;
}

function detectPaginationSmells(pattern: LinqPattern, smells: SmellDraft[]): void {
  if (pattern.hasToListBeforeSkipTake) {
    smells.push({
      type: "IN_MEMORY_PAGINATION",
      severity: "high",
      message: "Skip/Take applied after materialization.",
      impact: "Pagination happens in memory instead of the database.",
      suggestion: "Apply OrderBy/Skip/Take before ToListAsync.",
      evidence: "Materialization occurs before Skip/Take.",
    });
  }

  if (pattern.hasSkipTake && !pattern.hasOrderBy) {
    smells.push({
      type: "SKIP_TAKE_WITHOUT_ORDER_BY",
      severity: "medium",
      message: "Skip/Take without OrderBy may produce non-deterministic results.",
      impact: "Pagination results may vary between executions.",
      suggestion: "Add a deterministic OrderBy before Skip/Take.",
    });
  }
}

function detectCountSmells(code: string, smells: SmellDraft[]): void {
  if (/\.Count(?:Async)?\s*\(\s*\)\s*>\s*0/.test(code) && isExistenceCountUsage(code)) {
    smells.push({
      type: "COUNT_GREATER_THAN_ZERO",
      severity: "low",
      message: "Count() > 0 used for existence check.",
      impact: "Count scans more rows than necessary when only existence is needed.",
      suggestion: "Use Any()/AnyAsync() instead of Count() > 0 when the count value is not used.",
    });
  }

  if (/\.Count(?:Async)?\s*\(\s*\)\s*==\s*0/.test(code) && isExistenceCountUsage(code, true)) {
    smells.push({
      type: "COUNT_GREATER_THAN_ZERO",
      severity: "low",
      message: "Count() == 0 used for absence check.",
      impact: "Count scans more rows than necessary when only existence is needed.",
      suggestion: "Use !Any()/!AnyAsync() instead of Count() == 0 when the count value is not used.",
    });
  }
}

function isExistenceCountUsage(code: string, equalsZero = false): boolean {
  const pattern = equalsZero
    ? /\.Count(?:Async)?\s*\(\s*\)\s*==\s*0/
    : /\.Count(?:Async)?\s*\(\s*\)\s*>\s*0/;

  if (!pattern.test(code)) {
    return false;
  }

  if (/return\s+[^;]*\.Count(?:Async)?\s*\(\s*\)/.test(code)) {
    return false;
  }
  if (/=\s*[^;]*\.Count(?:Async)?\s*\(\s*\)\s*;/.test(code) && !/if\s*\(/.test(code)) {
    return false;
  }
  return true;
}

function detectContainsSmells(code: string, smells: SmellDraft[]): void {
  if (
    /\w+(Ids|IdList|ids|idList|IdsList)\s*\.Contains\s*\(/.test(code) ||
    /(?:var|List<int>|IEnumerable<int>)\s+\w*[iI]ds?\s*=[\s\S]*?\.Contains\s*\(/.test(code) ||
    /\w+\.Contains\s*\(\s*\w+\.\w+Id\s*\)/.test(code)
  ) {
    smells.push({
      type: "LARGE_CONTAINS_RISK",
      severity: "medium",
      message: "Contains with an external ID list or collection detected.",
      impact: "Large IN/filter lists can degrade performance and hit provider limits.",
      suggestion:
        "For large ID sets on relational providers, consider batching, TVP, or temp tables (manual review required).",
    });
  }
}

function detectFilterFunctionSmells(code: string, smells: SmellDraft[]): void {
  const functionPatterns = [
    /\.Where\s*\([^)]*\.(?:ToLower|ToUpper|Trim|ToString|Date)\s*\(/,
    /\.Where\s*\([^)]*Convert\.To\w+\s*\(/,
    /\.Where\s*\([^)]*string\.Format\s*\(/,
  ];

  if (functionPatterns.some((p) => p.test(code))) {
    smells.push({
      type: "FUNCTION_ON_FILTERED_COLUMN",
      severity: "medium",
      message: "Function applied to a filtered column inside Where.",
      impact: "May prevent index usage or efficient SQL translation.",
      suggestion:
        "Prefer normalized values, appropriate collation, or persisted normalized columns instead of wrapping the column.",
    });
  }
}

function detectCustomMethodSmells(code: string, smells: SmellDraft[]): void {
  if (/\.Where\s*\([^)]*=>\s*[^)]*\b[A-Z]\w*\s*\([^)]*\)/.test(code)) {
    const customMethodMatch = code.match(/\.Where\s*\([^)]*=>\s*[^)]*\b([A-Z]\w*)\s*\(/);
    const methodName = customMethodMatch?.[1];
    const allowed = new Set(["string", "Convert", "Math", "DateTime", "EF", "DbFunctions"]);
    if (methodName && !allowed.has(methodName)) {
      smells.push({
        type: "CUSTOM_METHOD_IN_WHERE",
        severity: "high",
        message: "Custom C# method detected inside Where.",
        impact: "May not translate to SQL or may force client evaluation.",
        suggestion: "Ensure the predicate can be translated to SQL or move logic server-side.",
        evidence: methodName ? `Method: ${methodName}()` : undefined,
      });
    }
  }
}

function detectGroupBySmells(code: string, smells: SmellDraft[]): void {
  if (/\.GroupBy\s*\(\s*\w+\s*=>\s*new\s*\{/.test(code)) {
    smells.push({
      type: "GROUP_BY_NAVIGATION_OR_OBJECT",
      severity: "medium",
      message: "GroupBy uses a complex object/anonymous type key.",
      impact: "Complex GroupBy keys may not translate efficiently to SQL.",
      suggestion: "Prefer scalar keys such as foreign key IDs (e.g., GroupBy(x => x.ClienteId)).",
    });
    return;
  }

  if (/\.GroupBy\s*\(\s*\w+\s*=>\s*\w+\.\w+\s*\)/.test(code)) {
    const keyMatch = code.match(/\.GroupBy\s*\(\s*\w+\s*=>\s*\w+\.(\w+)\s*\)/);
    const keyProp = keyMatch?.[1];
    if (keyProp && !keyProp.endsWith("Id") && keyProp[0] === keyProp[0]?.toUpperCase()) {
      smells.push({
        type: "GROUP_BY_NAVIGATION_OR_OBJECT",
        severity: "medium",
        message: "GroupBy may use a navigation or non-scalar property.",
        impact: "May not translate efficiently to SQL.",
        suggestion: "Prefer scalar keys such as foreign key IDs (e.g., GroupBy(x => x.ClienteId)).",
        evidence: keyProp ? `Key: ${keyProp}` : undefined,
      });
    }
  }
}

function detectFirstOrDefaultSmells(code: string, normalized: string, smells: SmellDraft[]): void {
  const firstIndex = Math.min(
    indexOfCall(normalized, "FirstOrDefault") === -1 ? Infinity : indexOfCall(normalized, "FirstOrDefault"),
    indexOfCall(normalized, "First") === -1 ? Infinity : indexOfCall(normalized, "First"),
  );
  const orderIndex = Math.min(
    indexOfCall(normalized, "OrderBy") === -1 ? Infinity : indexOfCall(normalized, "OrderBy"),
    indexOfCall(normalized, "OrderByDescending") === -1
      ? Infinity
      : indexOfCall(normalized, "OrderByDescending"),
  );
  const whereIndex = indexOfCall(normalized, "Where");

  if (
    firstIndex !== Infinity &&
    orderIndex === Infinity &&
    whereIndex !== -1 &&
    whereIndex < firstIndex &&
    /\.FirstOrDefault(?:Async)?\s*\(/.test(code)
  ) {
    smells.push({
      type: "FIRST_OR_DEFAULT_WITHOUT_ORDER",
      severity: "low",
      message: "FirstOrDefault without OrderBy when a filter is present.",
      impact: "Result may be non-deterministic if business rules expect a specific record.",
      suggestion: "Add OrderBy when a deterministic record is required.",
    });
  }
}

function detectEntityLoadForDtoSmells(code: string, pattern: LinqPattern, smells: SmellDraft[]): void {
  if (
    pattern.hasDtoProjection &&
    /\.(?:ToList|ToArray)(?:Async)?\s*\(\s*\)/.test(code) &&
    !/return\s+await\s+[\s\S]*?\.Select\s*\(\s*\w+\s*=>\s*new\s+\w+(Dto|DTO|ViewModel|Response)/.test(code)
  ) {
    smells.push({
      type: "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO",
      severity: "medium",
      message: "Full entities are loaded before converting to DTO.",
      impact: "Loads unnecessary columns and relationships.",
      suggestion: "Project directly to DTO in the database query with Select.",
    });
  }
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
