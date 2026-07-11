import type { QueryTextEdit } from '../../domain/query-fix.js';
import type { SourceRange } from '../../domain/source-range.js';

function rangesOverlap(left: SourceRange, right: SourceRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function validateRange(range: SourceRange, codeLength: number): void {
  if (range.start < 0 || range.end <= range.start || range.end > codeLength) {
    throw new Error(`Invalid source range: ${range.start}-${range.end} for code length ${codeLength}`);
  }
}

export function applyTextEdits(code: string, edits: QueryTextEdit[]): string {
  if (edits.length === 0) {
    return code;
  }

  const sorted = [...edits].sort((left, right) => right.range.start - left.range.start);

  for (const edit of sorted) {
    validateRange(edit.range, code.length);
  }

  for (let index = 0; index < sorted.length; index += 1) {
    for (let other = index + 1; other < sorted.length; other += 1) {
      if (rangesOverlap(sorted[index].range, sorted[other].range)) {
        throw new Error('Overlapping text edits are not allowed.');
      }
    }
  }

  let result = code;

  for (const edit of sorted) {
    result = `${result.slice(0, edit.range.start)}${edit.newText}${result.slice(edit.range.end)}`;
  }

  return result;
}
