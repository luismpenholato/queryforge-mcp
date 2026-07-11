import type { QueryFix, QueryTextEdit } from '../../domain/query-fix.js';
import type { SourceRange } from '../../domain/source-range.js';
import { findAllPatternMatches } from './pattern-match.js';
import { rangeFromIndices } from './source-range.js';

const COUNT_GREATER_THAN_ZERO_PATTERN =
  /\.(?<method>Count|CountAsync)\s*\((?<args>[^)]*)\)\s*(?<operator>>=|>)\s*(?<value>0|1)/g;

interface CountGreaterThanZeroMatch {
  range: SourceRange;
  method: 'Count' | 'CountAsync';
  args: string;
  operator: '>=' | '>';
  value: '0' | '1';
}

function isSafeCountExistenceCheck(operator: '>=' | '>', value: '0' | '1'): boolean {
  return (operator === '>' && value === '0') || (operator === '>=' && value === '1');
}

function parseCountGreaterThanZeroMatches(code: string): CountGreaterThanZeroMatch[] {
  const matches: CountGreaterThanZeroMatch[] = [];

  for (const match of findAllPatternMatches(code, COUNT_GREATER_THAN_ZERO_PATTERN)) {
    const method = match.groups.method as 'Count' | 'CountAsync' | undefined;
    const operator = match.groups.operator as '>=' | '>' | undefined;
    const value = match.groups.value as '0' | '1' | undefined;

    if (!method || !operator || !value || !isSafeCountExistenceCheck(operator, value)) {
      continue;
    }

    const expressionEnd = match.range.end;
    const expressionStart = code.lastIndexOf(`.${method}`, expressionEnd);

    if (expressionStart === -1) {
      continue;
    }

    const range = rangeFromIndices(expressionStart, expressionEnd, code);

    if (!range) {
      continue;
    }

    matches.push({
      range,
      method,
      args: match.groups.args ?? '',
      operator,
      value
    });
  }

  return matches;
}

function buildCountToAnyFix(match: CountGreaterThanZeroMatch): QueryFix {
  const replacementMethod = match.method === 'CountAsync' ? 'AnyAsync' : 'Any';
  const edit: QueryTextEdit = {
    range: match.range,
    newText: `.${replacementMethod}(${match.args})`
  };

  return {
    id:
      match.method === 'CountAsync'
        ? 'replace-count-async-with-any-async'
        : 'replace-count-with-any',
    title:
      match.method === 'CountAsync'
        ? 'Replace CountAsync() > 0 with AnyAsync()'
        : 'Replace Count() > 0 with Any()',
    safety: 'safe',
    edits: [edit]
  };
}

export function buildCountGreaterThanZeroFixes(code: string): Array<{
  range: SourceRange;
  fix: QueryFix;
}> {
  return parseCountGreaterThanZeroMatches(code).map((match) => ({
    range: match.range,
    fix: buildCountToAnyFix(match)
  }));
}

export function buildCountGreaterThanZeroSmellData(code: string): Array<{
  range: SourceRange;
  fixes: QueryFix[];
  matchedText: string;
}> {
  return parseCountGreaterThanZeroMatches(code).map((match) => ({
    range: match.range,
    fixes: [buildCountToAnyFix(match)],
    matchedText: code.slice(match.range.start, match.range.end)
  }));
}

const DB_SET_PATTERN = /(_context\.[A-Za-z0-9_]+|\.Set<[^>]+>\s*\(\s*\))/;

export function buildAsNoTrackingFix(code: string): QueryFix | undefined {
  if (/\.AsNoTracking\s*\(/.test(code)) {
    return undefined;
  }

  if (/\.(?:Add|Update|Remove|Attach)\s*\(|SaveChanges(?:Async)?/.test(code)) {
    return undefined;
  }

  const match = DB_SET_PATTERN.exec(code);

  if (!match || match.index === undefined) {
    return undefined;
  }

  const insertionPoint = match.index + match[0].length;
  const nextDotIndex = code.indexOf('.', insertionPoint);

  if (nextDotIndex === -1) {
    return undefined;
  }

  const lineStart = code.lastIndexOf('\n', insertionPoint) + 1;
  const linePrefix = code.slice(lineStart, insertionPoint);
  const indentMatch = /^[\t ]*/.exec(linePrefix);
  const continuationIndent = `${indentMatch?.[0] ?? ''}    `;
  const insertText = code[insertionPoint] === '\n' || code[insertionPoint] === '\r'
    ? `\n${continuationIndent}.AsNoTracking()`
    : `.AsNoTracking()`;

  return {
    id: 'add-as-no-tracking',
    title: 'Add AsNoTracking() for read-only query',
    safety: 'safe',
    edits: [
      {
        range: { start: nextDotIndex, end: nextDotIndex + 1 },
        newText: `${insertText}.`
      }
    ]
  };
}

export function findAsNoTrackingInsertionRange(code: string): SourceRange | undefined {
  const match = DB_SET_PATTERN.exec(code);

  if (!match || match.index === undefined) {
    return undefined;
  }

  return {
    start: match.index,
    end: match.index + match[0].length
  };
}
