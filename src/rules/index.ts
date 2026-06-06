import { QueryRule } from '../domain/query-rule.js';
import { toListBeforeSelectRule } from './to-list-before-select.rule.js';
import { missingAsNoTrackingRule } from './missing-as-no-tracking.rule.js';
import { countGreaterThanZeroRule } from './count-greater-than-zero.rule.js';
import { paginationWithoutOrderByRule } from './pagination-without-orderby.rule.js';
import { unnecessaryIncludeWithProjectionRule } from './unnecessary-include-with-projection.rule.js';
import { firstWithoutOrderByRule } from './first-without-orderby.rule.js';
import { functionOnColumnFilterRule } from './function-on-column-filter.rule.js';
import { toStringInQueryFilterRule } from './to-string-in-query-filter.rule.js';
import { stringTransformOnColumnFilterRule } from './string-transform-on-column-filter.rule.js';
import { containsOnConvertedValueRule } from './contains-on-converted-value.rule.js';
import { containsOnStringColumnRule } from './contains-on-string-column.rule.js';
import { toListBeforeWhereRule } from './to-list-before-where.rule.js';
import { toListBeforeOrderByRule } from './to-list-before-order-by.rule.js';
import { toListBeforeSkipTakeRule } from './to-list-before-skip-take.rule.js';
import { asEnumerableBeforeQueryOperatorsRule } from './as-enumerable-before-query-operators.rule.js';
import { clientSideMethodInWhereRule } from './client-side-method-in-where.rule.js';
import { largeTakeRule } from './large-take.rule.js';
import { largeTakeWithOrderByRule } from './large-take-with-order-by.rule.js';
import { multipleOrderByRule } from './multiple-order-by.rule.js';
import { multipleCollectionIncludesRule } from './multiple-collection-includes.rule.js';
import { redundantMonthRangeFilterRule } from './redundant-month-range-filter.rule.js';
import { nPlusOneQueryInLoopRule } from './n-plus-one-query-in-loop.rule.js';
import { multipleRoundTripsInLoopRule } from './multiple-round-trips-in-loop.rule.js';
import { cartesianProductQueryRule } from './cartesian-product-query.rule.js';
import { correlatedSubqueryInProjectionRule } from './correlated-subquery-in-projection.rule.js';
import { implicitConversionInFilterRule } from './implicit-conversion-in-filter.rule.js';
import { duplicatedPredicateRule } from './duplicated-predicate.rule.js';
import { fullEntityMaterializationRule } from './full-entity-materialization.rule.js';

export const queryRules: QueryRule[] = [
  toListBeforeSelectRule,
  missingAsNoTrackingRule,
  countGreaterThanZeroRule,
  paginationWithoutOrderByRule,
  unnecessaryIncludeWithProjectionRule,
  firstWithoutOrderByRule,
  functionOnColumnFilterRule,
  toStringInQueryFilterRule,
  stringTransformOnColumnFilterRule,
  containsOnConvertedValueRule,
  containsOnStringColumnRule,
  toListBeforeWhereRule,
  toListBeforeOrderByRule,
  toListBeforeSkipTakeRule,
  asEnumerableBeforeQueryOperatorsRule,
  clientSideMethodInWhereRule,
  largeTakeRule,
  largeTakeWithOrderByRule,
  multipleOrderByRule,
  multipleCollectionIncludesRule,
  redundantMonthRangeFilterRule,
  nPlusOneQueryInLoopRule,
  multipleRoundTripsInLoopRule,
  cartesianProductQueryRule,
  correlatedSubqueryInProjectionRule,
  implicitConversionInFilterRule,
  duplicatedPredicateRule,
  fullEntityMaterializationRule
];
