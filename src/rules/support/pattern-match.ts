import type { SourceRange } from '../../domain/source-range.js';
import { rangeFromMatch } from './source-range.js';

export interface PatternMatch {
  text: string;
  range: SourceRange;
  groups: Record<string, string>;
}

function cloneGlobalPattern(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function extractNamedGroups(match: RegExpExecArray): Record<string, string> {
  const groups: Record<string, string> = {};

  if (match.groups) {
    for (const [name, value] of Object.entries(match.groups)) {
      if (value !== undefined) {
        groups[name] = value;
      }
    }
  }

  return groups;
}

export function findAllPatternMatches(
  code: string,
  pattern: RegExp,
  groupIndex = 0
): PatternMatch[] {
  const regex = cloneGlobalPattern(pattern);
  const matches: PatternMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    const range = rangeFromMatch(code, match, groupIndex);

    if (!range) {
      continue;
    }

    const text = code.slice(range.start, range.end);
    matches.push({ text, range, groups: extractNamedGroups(match) });

    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  return matches;
}

export function findFirstPatternMatch(
  code: string,
  pattern: RegExp,
  groupIndex = 0
): PatternMatch | undefined {
  const matches = findAllPatternMatches(code, pattern, groupIndex);
  return matches[0];
}

export function findLiteralMatch(code: string, literal: string): PatternMatch | undefined {
  if (!literal) {
    return undefined;
  }

  const index = code.indexOf(literal);

  if (index === -1) {
    return undefined;
  }

  return {
    text: literal,
    range: { start: index, end: index + literal.length },
    groups: {}
  };
}

export function findAllLiteralMatches(code: string, literal: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  let searchFrom = 0;

  while (searchFrom < code.length) {
    const index = code.indexOf(literal, searchFrom);

    if (index === -1) {
      break;
    }

    matches.push({
      text: literal,
      range: { start: index, end: index + literal.length },
      groups: {}
    });

    searchFrom = index + literal.length;
  }

  return matches;
}

export function findUniquePatternMatch(
  code: string,
  pattern: RegExp,
  groupIndex = 0
): PatternMatch | undefined {
  const matches = findAllPatternMatches(code, pattern, groupIndex);
  return matches.length === 1 ? matches[0] : undefined;
}
