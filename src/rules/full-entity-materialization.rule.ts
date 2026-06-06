import { QueryRule } from '../domain/query-rule.js';
import { createSmell, hasFullEntityMaterialization } from './rule-helpers.js';

export const fullEntityMaterializationRule: QueryRule = {
  code: 'FULL_ENTITY_MATERIALIZATION',

  analyze(request) {
    if (!hasFullEntityMaterialization(request.code)) {
      return [];
    }

    return [
      createSmell({
        code: 'FULL_ENTITY_MATERIALIZATION',
        title: 'Materialização de entidade inteira',
        severity: 'medium',
        category: 'projection',
        message: 'The query materializes full entities instead of projecting only required columns.',
        whyItMatters:
          'Loading full entities may retrieve unnecessary columns, increase memory usage and enable tracking overhead.',
        suggestion: 'Project only required columns before materialization.',
        rewritePlan: [
          'Add Select to project only required fields before ToList/ToListAsync.',
          'Combine with AsNoTracking for read-only queries.',
          'Avoid loading wide entities when only a few columns are needed.'
        ],
        safeAutoFix: false,
        confidence: 0.75
      })
    ];
  }
};
