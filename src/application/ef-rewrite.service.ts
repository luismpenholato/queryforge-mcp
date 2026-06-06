import { QueryAnalysisResult } from '../domain/query-analysis-result.js';

export class EfRewriteService {
  suggest(code: string, analysis: QueryAnalysisResult): string {
    let rewritten = code;

    const hasToListBeforeSelect = analysis.smells.some(
      (item) => item.code === 'TO_LIST_BEFORE_SELECT'
    );

    const hasMissingAsNoTracking = analysis.smells.some(
      (item) => item.code === 'MISSING_AS_NO_TRACKING'
    );

    const hasCountGreaterThanZero = analysis.smells.some(
      (item) => item.code === 'COUNT_GREATER_THAN_ZERO'
    );

    if (hasMissingAsNoTracking && !rewritten.includes('.AsNoTracking()')) {
      rewritten = this.insertAsNoTracking(rewritten);
    }

    if (hasCountGreaterThanZero) {
      rewritten = rewritten
        .replace(/\.CountAsync\s*\(([^)]*)\)\s*>\s*0/g, '.AnyAsync($1)')
        .replace(/\.Count\s*\(([^)]*)\)\s*>\s*0/g, '.Any($1)')
        .replace(/\.CountAsync\s*\(([^)]*)\)\s*>=\s*1/g, '.AnyAsync($1)')
        .replace(/\.Count\s*\(([^)]*)\)\s*>=\s*1/g, '.Any($1)');
    }

    if (hasToListBeforeSelect) {
      return [
        '/*',
        'QueryForge não aplicou rewrite automático para TO_LIST_BEFORE_SELECT.',
        'Motivo: mover Select antes de ToListAsync pode exigir ajuste manual de DTO, Includes e navegações.',
        'Plano sugerido:',
        '1. Remover ToListAsync antes do Select.',
        '2. Mover a projeção Select para dentro da query IQueryable.',
        '3. Remover Includes desnecessários se os dados forem projetados diretamente.',
        '4. Manter ToListAsync apenas no final.',
        '*/',
        '',
        rewritten
      ].join('\n');
    }

    return rewritten;
  }

  private insertAsNoTracking(code: string): string {
    const dbSetPattern = /(_context\.[A-Za-z0-9_]+|\.Set<[^>]+>\s*\(\s*\))/;

    if (!dbSetPattern.test(code)) {
      return code;
    }

    return code.replace(dbSetPattern, (match) => `${match}.AsNoTracking()`);
  }
}
