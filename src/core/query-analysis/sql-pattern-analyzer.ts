export interface SqlPatternAnalysis {
  whereColumns: string[];
  joinColumns: string[];
  orderByColumns: string[];
  groupByColumns: string[];
  hasLeadingWildcardLike: boolean;
  hasSelectStar: boolean;
  hasFunctionOnFilteredColumn: boolean;
}

export function analyzeSqlPatterns(sql: string): SqlPatternAnalysis {
  const normalized = sql.replace(/\s+/g, " ");

  const whereColumns = extractSqlColumns(normalized, /WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|OFFSET|$)/i);
  const joinColumns = extractJoinColumns(normalized);
  const orderByColumns = extractSqlColumns(normalized, /ORDER\s+BY\s+(.+?)(?:LIMIT|OFFSET|$)/i);
  const groupByColumns = extractSqlColumns(normalized, /GROUP\s+BY\s+(.+?)(?:ORDER|HAVING|$)/i);

  return {
    whereColumns,
    joinColumns,
    orderByColumns,
    groupByColumns,
    hasLeadingWildcardLike: /LIKE\s+'%/i.test(normalized),
    hasSelectStar: /SELECT\s+\*\s+FROM/i.test(normalized),
    hasFunctionOnFilteredColumn: /WHERE\s+\w+\s*\(\s*\w+/i.test(normalized),
  };
}

function extractSqlColumns(sql: string, pattern: RegExp): string[] {
  const match = pattern.exec(sql);
  if (!match?.[1]) return [];

  return match[1]
    .split(/,|\s+AND\s+|\s+OR\s+/i)
    .map((part) => {
      const colMatch = part.match(/(\w+)\s*[=<>]/);
      return colMatch?.[1] ?? part.trim().split(/\s+/)[0];
    })
    .filter(Boolean);
}

function extractJoinColumns(sql: string): string[] {
  const columns: string[] = [];
  const regex = /JOIN\s+\w+\s+\w+\s+ON\s+(\w+\.\w+)\s*=\s*(\w+\.\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    columns.push(match[1], match[2]);
  }
  return columns;
}

export function analyzeCodeForSqlHints(code: string): SqlPatternAnalysis {
  const filters = code.match(/\.Where\s*\([^)]+\)/g) ?? [];
  const whereColumns = filters.flatMap((f) => {
    const matches = f.match(/(\w+)\s*[=<>!]/g);
    return matches?.map((m) => m.replace(/[=<>!]/g, "")) ?? [];
  });

  const orderMatch = code.match(/\.OrderBy(?:Descending)?\s*\(\s*\w+\s*=>\s*(\w+\.?\w*)/);
  const orderByColumns = orderMatch ? [orderMatch[1]] : [];

  return {
    whereColumns,
    joinColumns: [],
    orderByColumns,
    groupByColumns: [],
    hasLeadingWildcardLike: /\.Contains\s*\(/.test(code),
    hasSelectStar: false,
    hasFunctionOnFilteredColumn: /\.Where\s*\([^)]*\.(ToLower|ToUpper|ToString|Date)\s*\(/.test(code),
  };
}
