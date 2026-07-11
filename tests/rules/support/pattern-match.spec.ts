import { describe, expect, it } from 'vitest';
import { findAllPatternMatches, findUniquePatternMatch } from '../../../src/rules/support/pattern-match.js';

describe('pattern-match helpers', () => {
  it('should return exact slice ranges', () => {
    const code = 'var exists = query.Count() > 0;';
    const matches = findAllPatternMatches(code, /\.Count\s*\(\)\s*>\s*0/);

    expect(matches).toHaveLength(1);
    expect(code.slice(matches[0].range.start, matches[0].range.end)).toBe('.Count() > 0');
  });

  it('should support \\n and \\r\\n code', () => {
    const code = 'await query\r\n  .CountAsync() > 0;';
    const matches = findAllPatternMatches(code, /\.CountAsync\s*\(\)\s*>\s*0/);

    expect(matches).toHaveLength(1);
    expect(code.slice(matches[0].range.start, matches[0].range.end)).toBe('.CountAsync() > 0');
  });

  it('should support multiline matches', () => {
    const code = 'await query\n  .CountAsync() > 0;';
    const matches = findAllPatternMatches(code, /\.CountAsync\s*\(\)\s*>\s*0/);

    expect(matches).toHaveLength(1);
  });

  it('should return multiple occurrences', () => {
    const code = 'a.Count() > 0; b.Count() > 0;';
    const matches = findAllPatternMatches(code, /\.Count\s*\(\)\s*>\s*0/g);

    expect(matches).toHaveLength(2);
  });

  it('should return undefined for ambiguous unique match requests', () => {
    const code = 'a.Count() > 0; b.Count() > 0;';
    const match = findUniquePatternMatch(code, /\.Count\s*\(\)\s*>\s*0/);

    expect(match).toBeUndefined();
  });

  it('should keep ranges inside code bounds', () => {
    const code = 'query.Count() > 0';
    const match = findAllPatternMatches(code, /Count\(\)/)[0];

    expect(match.range.start).toBeGreaterThanOrEqual(0);
    expect(match.range.end).toBeLessThanOrEqual(code.length);
  });
});
