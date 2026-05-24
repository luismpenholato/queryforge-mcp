import type { LinqPattern } from "./query-analysis.types.js";

export function isComplexQuery(code: string, pattern: LinqPattern): boolean {
  const varAssignments = (code.match(/(?:var|List<\w+>|IEnumerable<\w+>)\s+\w+\s*=/g) ?? []).length;
  if (varAssignments > 2) {
    return true;
  }

  if (/\.Join\s*\(|\.GroupJoin\s*\(|\.DefaultIfEmpty\s*\(/.test(code)) {
    return true;
  }

  if (/PredicateBuilder|Dynamic LINQ|Expression<Func|BuildFilter|ApplyFilter/i.test(code)) {
    return true;
  }

  if (pattern.postMaterializationVariable && pattern.hasPostQueryNavigationUse) {
    return true;
  }

  const methodCount = (code.match(/\.\w+(?:Async)?\s*\(/g) ?? []).length;
  if (methodCount > 12) {
    return true;
  }

  return false;
}

export function isSimpleMaterializationChain(code: string, pattern: LinqPattern): boolean {
  if (isComplexQuery(code, pattern)) {
    return false;
  }

  if (pattern.postMaterializationVariable) {
    return false;
  }

  if (/\.Include\s*\(/.test(code) && pattern.hasDtoProjection) {
    return false;
  }

  return true;
}

export function hasBehaviorSensitiveConstructs(code: string): boolean {
  return (
    /\.Include\s*\(/.test(code) ||
    /\.GroupBy\s*\(/.test(code) ||
    /\.FirstOrDefault(?:Async)?\s*\(/.test(code) ||
    /\.Join\s*\(|\.GroupJoin\s*\(|\.DefaultIfEmpty\s*\(/.test(code) ||
    /\?\./.test(code) ||
    /\.ThenInclude\s*\(/.test(code)
  );
}
