import { describe, expect, it } from 'vitest';
import { applyTextEdits } from '../../../src/rules/support/apply-text-edits.js';
import {
  buildAsNoTrackingFix,
  buildCountGreaterThanZeroSmellData
} from '../../../src/rules/support/query-fixes.js';

describe('query fixes', () => {
  it('should build a safe sync Count to Any fix', () => {
    const code = 'var exists = query.Count() > 0;';
    const occurrences = buildCountGreaterThanZeroSmellData(code);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].fixes[0].id).toBe('replace-count-with-any');

    const rewritten = applyTextEdits(code, occurrences[0].fixes[0].edits ?? []);
    expect(rewritten).toBe('var exists = query.Any();');
  });

  it('should build a safe async CountAsync to AnyAsync fix preserving await', () => {
    const code = 'var exists = await query.CountAsync() > 0;';
    const occurrences = buildCountGreaterThanZeroSmellData(code);

    expect(occurrences[0].fixes[0].id).toBe('replace-count-async-with-any-async');

    const rewritten = applyTextEdits(code, occurrences[0].fixes[0].edits ?? []);
    expect(rewritten).toBe('var exists = await query.AnyAsync();');
  });

  it('should support multiline CountAsync detection', () => {
    const code = `var exists = await query
  .CountAsync() > 0;`;

    const occurrences = buildCountGreaterThanZeroSmellData(code);
    expect(occurrences).toHaveLength(1);
  });

  it('should not build a safe fix for != 0', () => {
    const code = 'var exists = query.Count() != 0;';
    const occurrences = buildCountGreaterThanZeroSmellData(code);

    expect(occurrences).toHaveLength(0);
  });

  it('should insert AsNoTracking with indentation', () => {
    const code = `
return await _context.Products
    .Where(x => x.IsActive)
    .Select(x => x.Name)
    .ToListAsync();`;

    const fix = buildAsNoTrackingFix(code);
    expect(fix?.id).toBe('add-as-no-tracking');

    const rewritten = applyTextEdits(code, fix?.edits ?? []);
    expect(rewritten).toContain('.AsNoTracking()');
    expect(rewritten.indexOf('.AsNoTracking()')).toBeLessThan(rewritten.indexOf('.Where'));
  });

  it('should not duplicate AsNoTracking', () => {
    const code = '_context.Products.AsNoTracking().Where(x => x.IsActive).Select(x => x.Name).ToListAsync();';
    expect(buildAsNoTrackingFix(code)).toBeUndefined();
  });

  it('should not build AsNoTracking fix for write operations', () => {
    const code = '_context.Products.Where(x => x.IsActive).Select(x => x.Name).ToListAsync(); _context.SaveChanges();';
    expect(buildAsNoTrackingFix(code)).toBeUndefined();
  });
});
