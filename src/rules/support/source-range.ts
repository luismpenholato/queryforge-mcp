import type { SourceRange } from '../../domain/source-range.js';

export function createRange(start: number, end: number, codeLength?: number): SourceRange | undefined {
  if (start < 0 || end <= start) {
    return undefined;
  }

  if (codeLength !== undefined && end > codeLength) {
    return undefined;
  }

  return { start, end };
}

export function rangeFromIndices(start: number, end: number, code: string): SourceRange | undefined {
  return createRange(start, end, code.length);
}

export function rangeFromMatch(
  code: string,
  match: RegExpExecArray,
  groupIndex = 0
): SourceRange | undefined {
  if (match.index === undefined) {
    return undefined;
  }

  if (groupIndex === 0) {
    return createRange(match.index, match.index + match[0].length, code.length);
  }

  const group = match[groupIndex];

  if (!group) {
    return undefined;
  }

  const groupStart = match.indices?.[groupIndex]?.[0];

  if (groupStart !== undefined) {
    return createRange(groupStart, groupStart + group.length, code.length);
  }

  const prefix = match[0].slice(0, match[0].indexOf(group));
  const start = match.index + prefix.length;

  return createRange(start, start + group.length, code.length);
}

export function matchedText(code: string, range: SourceRange): string {
  return code.slice(range.start, range.end);
}
