import { QueryRule } from '../domain/query-rule.js';
import { toListBeforeSelectRule } from './to-list-before-select.rule.js';
import { missingAsNoTrackingRule } from './missing-as-no-tracking.rule.js';
import { countGreaterThanZeroRule } from './count-greater-than-zero.rule.js';
import { paginationWithoutOrderByRule } from './pagination-without-orderby.rule.js';
import { unnecessaryIncludeWithProjectionRule } from './unnecessary-include-with-projection.rule.js';
import { firstWithoutOrderByRule } from './first-without-orderby.rule.js';

export const queryRules: QueryRule[] = [
  toListBeforeSelectRule,
  missingAsNoTrackingRule,
  countGreaterThanZeroRule,
  paginationWithoutOrderByRule,
  unnecessaryIncludeWithProjectionRule,
  firstWithoutOrderByRule
];
