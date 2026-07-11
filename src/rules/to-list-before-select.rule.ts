import { QueryRule } from '../domain/query-rule.js';
import { createSmell } from './rule-helpers.js';
import { findChainSegmentRange } from './support/where-range.js';

const TO_LIST_BEFORE_SELECT_PATTERN = /\.(?:ToList|ToListAsync)\s*\(\s*\)[\s\S]*?\.Select\s*\(/;

export const toListBeforeSelectRule: QueryRule = {
  code: 'TO_LIST_BEFORE_SELECT',

  analyze(request) {
    const code = request.code;

    if (!TO_LIST_BEFORE_SELECT_PATTERN.test(code)) {
      return [];
    }

    const range = findChainSegmentRange(
      code,
      /\.(?:ToList|ToListAsync)\s*\(\s*\)[\s\S]*?\.Select\s*\([^)]*\)/
    );

    return [
      createSmell({
        code: 'TO_LIST_BEFORE_SELECT',
        title: 'Materialization before projection',
        severity: 'high',
        message:
          'The query appears to call ToList/ToListAsync before Select, projecting in memory instead of the database.',
        suggestion:
          'Move Select before ToList/ToListAsync so only required fields are projected in the database.',
        confidence: 0.85,
        range
      })
    ];
  }
};
