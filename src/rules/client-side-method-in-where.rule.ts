import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasCustomMethodInWhere } from './rule-helpers.js';

export const clientSideMethodInWhereRule: QueryRule = {
  code: 'CLIENT_SIDE_METHOD_IN_WHERE',

  analyze(request) {
    if (!hasCustomMethodInWhere(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'CLIENT_SIDE_METHOD_IN_WHERE',
        title: 'Método customizado dentro do Where',
        severity: 'medium',
        category: 'translation',
        message:
          'A query chama método customizado dentro do Where, o que pode não traduzir para SQL.',
        whyItMatters:
          'Métodos customizados no predicado frequentemente forçam avaliação client-side ou falham na tradução, dependendo do provider e versão.',
        suggestion:
          'Garanta que o método seja traduzível para SQL. Prefira filtros baseados em expressão ou equivalentes no banco.',
        rewritePlan: [
          'Verifique se o método possui tradução SQL suportada pelo provider.',
          'Substitua por expressão inline traduzível ou lógica no banco.',
          'Valide o SQL gerado com logging do EF Core.'
        ],
        safeAutoFix: false,
        confidence: 0.78
      })
    ];
  }
};
