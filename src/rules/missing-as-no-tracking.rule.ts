import { QueryRule } from '../domain/query-rule.js';

export const missingAsNoTrackingRule: QueryRule = {
  code: 'MISSING_AS_NO_TRACKING',

  analyze(request) {
    const code = request.code;

    const looksLikeEfQuery =
      /_context\.|DbContext|\.Set<|\.Where\s*\(|\.Select\s*\(/.test(code);

    const hasProjection = /\.Select\s*\(/.test(code);
    const hasTrackingDisabled = /\.AsNoTracking\s*\(/.test(code);
    const hasWriteOperation =
      /\.Add\s*\(|\.Update\s*\(|\.Remove\s*\(|SaveChanges|SaveChangesAsync/.test(code);

    if (!looksLikeEfQuery || hasTrackingDisabled || hasWriteOperation) {
      return [];
    }

    if (!hasProjection && request.context?.toLowerCase().includes('read-only') !== true) {
      return [];
    }

    return [
      {
        code: 'MISSING_AS_NO_TRACKING',
        title: 'Consulta somente leitura sem AsNoTracking',
        severity: 'medium',
        message:
          'A query parece ser somente leitura e não usa AsNoTracking, o que pode gerar tracking desnecessário no EF Core.',
        suggestion:
          'Adicione AsNoTracking() em consultas read-only para reduzir overhead de tracking.',
        confidence: hasProjection ? 0.75 : 0.55
      }
    ];
  }
};
