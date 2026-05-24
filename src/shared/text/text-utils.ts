export function normalizeWhitespace(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

export function extractMethodCalls(code: string): string[] {
  const calls: string[] = [];
  const regex = /\.(\w+)(?:Async)?\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    calls.push(match[1]);
  }
  return calls;
}

export function indexOfCall(code: string, callName: string): number {
  const regex = new RegExp(`\\.${callName}(?:Async)?\\s*\\(`, "i");
  const match = regex.exec(code);
  return match?.index ?? -1;
}

export function hasPattern(code: string, pattern: RegExp): boolean {
  return pattern.test(code);
}

export function countOccurrences(code: string, pattern: RegExp): number {
  const globalPattern = pattern.global
    ? pattern
    : new RegExp(pattern.source, pattern.flags + "g");
  return (code.match(globalPattern) ?? []).length;
}

export function inferDtoName(code: string): string | undefined {
  const match = code.match(/new\s+(\w+Dto|\w+DTO|\w+ViewModel|\w+Response)\s*\{/);
  return match?.[1];
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

export function extractWhereFilters(code: string): string[] {
  const filters: string[] = [];
  const regex = /\.Where\s*\(\s*(?:\w+\s*=>\s*)?([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    filters.push(match[1].trim());
  }
  return filters;
}

export function extractTableNames(code: string): string[] {
  const tables = new Set<string>();
  const dbSetRegex = /_context\.(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = dbSetRegex.exec(code)) !== null) {
    tables.add(match[1]);
  }
  return [...tables];
}
