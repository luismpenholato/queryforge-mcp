import { QueryRule } from '../domain/query-rule.js';

export const unnecessaryIncludeWithProjectionRule: QueryRule = {
  code: 'UNNECESSARY_INCLUDE_WITH_PROJECTION',

  analyze(request) {
    const code = request.code;

    const hasInclude = /\.Include\s*\(/.test(code);
    const hasProjection = /\.Select\s*\(/.test(code);

    if (!hasInclude || !hasProjection) {
      return [];
    }

    return [
      {
        code: 'UNNECESSARY_INCLUDE_WITH_PROJECTION',
        title: 'Include possivelmente desnecessário com projeção',
        severity: 'medium',
        message:
          'A query usa Include junto com Select. Em projeções para DTO, o Include muitas vezes é desnecessário.',
        suggestion:
          'Verifique se o Include pode ser removido e se os campos necessários podem ser projetados diretamente no Select.',
        confidence: 0.7
      }
    ];
  }
};
