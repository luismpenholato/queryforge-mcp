import { QueryRule } from '../domain/query-rule.js';

export const toListBeforeSelectRule: QueryRule = {
  code: 'TO_LIST_BEFORE_SELECT',

  analyze(request) {
    const code = request.code;

    const hasToListBeforeSelect =
      /\.(ToList|ToListAsync)\s*\(\s*\)[\s\S]*\.Select\s*\(/.test(code);

    if (!hasToListBeforeSelect) {
      return [];
    }

    return [
      {
        code: 'TO_LIST_BEFORE_SELECT',
        title: 'Materialização antes da projeção',
        severity: 'high',
        message:
          'A query parece chamar ToList/ToListAsync antes do Select, fazendo a projeção em memória.',
        suggestion:
          'Mova o Select para antes do ToList/ToListAsync para projetar no banco apenas os campos necessários.',
        confidence: 0.85
      }
    ];
  }
};
