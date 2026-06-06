import { QueryRule } from '../domain/query-rule.js';

export const countGreaterThanZeroRule: QueryRule = {
  code: 'COUNT_GREATER_THAN_ZERO',

  analyze(request) {
    const code = request.code;

    const hasCountGreaterThanZero =
      /\.(Count|CountAsync)\s*\([^)]*\)\s*(>|!=)\s*0/.test(code) ||
      /\.(Count|CountAsync)\s*\([^)]*\)\s*>=\s*1/.test(code);

    if (!hasCountGreaterThanZero) {
      return [];
    }

    return [
      {
        code: 'COUNT_GREATER_THAN_ZERO',
        title: 'Uso de Count para verificar existência',
        severity: 'medium',
        message:
          'A query parece usar Count/CountAsync para verificar existência de registros.',
        suggestion:
          'Troque por Any/AnyAsync quando o objetivo for apenas verificar se existe pelo menos um registro.',
        confidence: 0.9
      }
    ];
  }
};
