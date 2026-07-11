import type { PatternMatch } from './pattern-match.js';
import { findAllPatternMatches } from './pattern-match.js';
import { rangeFromIndices } from './source-range.js';

function cloneGlobalPattern(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

export function extractWhereRanges(code: string): Array<{ start: number; end: number; body: string }> {
  const ranges: Array<{ start: number; end: number; body: string }> = [];
  const wherePattern = /\.Where\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = wherePattern.exec(code)) !== null) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let index = bodyStart;

    while (index < code.length && depth > 0) {
      const char = code[index];

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      }

      index += 1;
    }

    ranges.push({
      start: bodyStart,
      end: index - 1,
      body: code.slice(bodyStart, index - 1)
    });
  }

  return ranges;
}

export function findWherePatternMatches(code: string, pattern: RegExp, groupIndex = 0): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const whereRange of extractWhereRanges(code)) {
    const bodyMatches = findAllPatternMatches(whereRange.body, pattern, groupIndex);

    for (const bodyMatch of bodyMatches) {
      const start = whereRange.start + bodyMatch.range.start;
      const end = whereRange.start + bodyMatch.range.end;
      const range = rangeFromIndices(start, end, code);

      if (!range) {
        continue;
      }

      matches.push({
        text: code.slice(range.start, range.end),
        range,
        groups: bodyMatch.groups
      });
    }
  }

  return matches;
}

export function findFirstMethodCallRange(
  code: string,
  methodNames: string[]
): import('../../domain/source-range.js').SourceRange | undefined {
  const pattern = new RegExp(`\\.(${methodNames.join('|')})\\s*\\(`);
  const match = findAllPatternMatches(code, pattern, 1)[0];
  return match?.range;
}

export function findMethodCallRanges(
  code: string,
  methodNames: string[]
): import('../../domain/source-range.js').SourceRange[] {
  const pattern = new RegExp(`\\.(${methodNames.join('|')})\\s*\\([^)]*\\)`, 'g');
  return findAllPatternMatches(code, pattern).map((match) => match.range);
}

export function findChainSegmentRange(
  code: string,
  segmentPattern: RegExp
): import('../../domain/source-range.js').SourceRange | undefined {
  const regex = cloneGlobalPattern(segmentPattern);
  const match = regex.exec(code);

  if (!match || match.index === undefined) {
    return undefined;
  }

  return rangeFromIndices(match.index, match.index + match[0].length, code);
}
