import { describe, expect, it } from 'vitest';
import { fullEntityMaterializationRule } from '../../src/rules/full-entity-materialization.rule.js';

describe('fullEntityMaterializationRule', () => {
  it('should detect ToListAsync without Select', () => {
    const result = fullEntityMaterializationRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.LogEntries
          .Where(l => l.CreatedAt >= startDate)
          .OrderByDescending(l => l.CreatedAt)
          .Take(40_000)
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('FULL_ENTITY_MATERIALIZATION');
    expect(result[0].category).toBe('projection');
  });

  it('should not detect when Select is present before ToListAsync', () => {
    const result = fullEntityMaterializationRule.analyze({
      provider: 'ef-core',
      code: `
        return await _context.LogEntries
          .Where(l => l.CreatedAt >= startDate)
          .Select(l => new LogSummaryDto { Id = l.Id, Message = l.Message })
          .ToListAsync();
      `
    });

    expect(result).toHaveLength(0);
  });
});
