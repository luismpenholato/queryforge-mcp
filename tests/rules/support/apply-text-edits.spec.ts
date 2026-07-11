import { describe, expect, it } from 'vitest';
import { applyTextEdits } from '../../../src/rules/support/apply-text-edits.js';

describe('applyTextEdits', () => {
  it('should apply edits from highest offset to lowest', () => {
    const code = 'abcdef';
    const result = applyTextEdits(code, [
      { range: { start: 2, end: 4 }, newText: 'Z' },
      { range: { start: 0, end: 1 }, newText: 'X' }
    ]);

    expect(result).toBe('XbZef');
    expect(code).toBe('abcdef');
  });

  it('should support multiple non-overlapping edits', () => {
    const code = 'var exists = query.Count() > 0;';
    const result = applyTextEdits(code, [
      { range: { start: 18, end: 30 }, newText: '.Any()' }
    ]);

    expect(result).toBe('var exists = query.Any();');
  });

  it('should reject overlapping edits', () => {
    expect(() =>
      applyTextEdits('abcdef', [
        { range: { start: 1, end: 4 }, newText: 'X' },
        { range: { start: 3, end: 5 }, newText: 'Y' }
      ])
    ).toThrow(/Overlapping/);
  });

  it('should reject invalid ranges', () => {
    expect(() =>
      applyTextEdits('abc', [{ range: { start: 1, end: 10 }, newText: 'X' }])
    ).toThrow(/Invalid source range/);
  });
});
