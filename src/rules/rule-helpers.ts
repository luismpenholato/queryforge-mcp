import { QuerySmell } from '../domain/query-smell.js';
import { Severity } from '../domain/severity.js';

export interface SmellOptions {
  code: string;
  title: string;
  severity: Severity;
  message: string;
  suggestion: string;
  confidence: number;
  category?: string;
  whyItMatters?: string;
  rewritePlan?: string[];
  safeAutoFix?: boolean;
}

export function createSmell(options: SmellOptions): QuerySmell {
  return options;
}

export function looksLikeEfQuery(code: string): boolean {
  return /_context\.|DbContext|\.Set<|\.Where\s*\(|\.Select\s*\(|\.Include\s*\(/.test(code);
}

export function extractWhereBodies(code: string): string[] {
  const bodies: string[] = [];
  const wherePattern = /\.Where\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = wherePattern.exec(code)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;

    while (index < code.length && depth > 0) {
      const char = code[index];

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      }

      index += 1;
    }

    bodies.push(code.slice(start, index - 1));
  }

  return bodies;
}

export function hasWhereClause(code: string, pattern: RegExp): boolean {
  const bodies = extractWhereBodies(code);

  if (bodies.length === 0) {
    return false;
  }

  return bodies.some((body) => pattern.test(body));
}

export function parseTakeValue(code: string): number | null {
  const match = /\.Take\s*\(\s*(\d[\d_]*)\s*\)/.exec(code);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/_/g, ''), 10);
  return Number.isNaN(value) ? null : value;
}

export function hasLargeTake(code: string, threshold = 10_000): boolean {
  const value = parseTakeValue(code);
  return value !== null && value >= threshold;
}

const CLIENT_SIDE_METHOD_ALLOWLIST = new Set([
  'Contains',
  'StartsWith',
  'EndsWith',
  'ToString',
  'ToLower',
  'ToUpper',
  'Trim',
  'Substring',
  'Equals',
  'Compare',
  'CompareTo',
  'IsNullOrEmpty',
  'IsNullOrWhiteSpace',
  'Math',
  'string',
  'Convert',
  'DateTime',
  'TimeSpan',
  'Guid',
  'decimal',
  'int',
  'double',
  'float',
  'long',
  'short',
  'byte',
  'bool',
  'object',
  'Enumerable',
  'EF',
  'DbFunctions'
]);

export function hasCustomMethodInWhere(code: string): boolean {
  for (const whereBody of extractWhereBodies(code)) {
    const methodCalls = whereBody.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);

    for (const methodMatch of methodCalls) {
      const methodName = methodMatch[1];

      if (CLIENT_SIDE_METHOD_ALLOWLIST.has(methodName)) {
        continue;
      }

      if (/^[a-z]/.test(methodName) && !/^(is|has|can|should|will|must)/.test(methodName)) {
        continue;
      }

      if (/^[A-Z]/.test(methodName)) {
        return true;
      }

      if (
        /^(IsValid|Normalize|Match|Validate|Check|Filter|Parse|Format|Compute|Calculate|Resolve|Map|Build|Get|Set|Try)/.test(
          methodName
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function countIncludeCalls(code: string): number {
  const matches = code.match(/\.(?:Include|ThenInclude)\s*\(/g);
  return matches?.length ?? 0;
}

export function hasRedundantMonthRangeFilter(code: string): boolean {
  const monthListPattern =
    /new\s*\[\s*\]\s*\{\s*([\d\s,]+)\s*\}\s*\.Contains\s*\(\s*\w+(?:\.\w+)+\.Month\s*\)/;
  const match = monthListPattern.exec(code);

  if (!match) {
    return false;
  }

  const numbers = match[1]
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => !Number.isNaN(item));

  if (numbers.length < 12) {
    return false;
  }

  const unique = new Set(numbers);

  if (unique.size < 12) {
    return false;
  }

  for (let month = 1; month <= 12; month += 1) {
    if (!unique.has(month)) {
      return false;
    }
  }

  return true;
}
