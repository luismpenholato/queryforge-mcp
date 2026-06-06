import { QueryAnalysisResult } from '../domain/query-analysis-result.js';

export function formatAnalysisAsMarkdown(result: QueryAnalysisResult): string {
  const lines: string[] = [];

  lines.push(`Resumo: ${result.summary}`);
  lines.push(`Severidade: ${result.severity}`);
  lines.push(`Revisão manual necessária: ${result.manualReviewRequired ? 'sim' : 'não'}`);
  lines.push('');

  if (result.smells.length === 0) {
    lines.push('Nenhum problema identificado pelas regras atuais.');
    return lines.join('\n');
  }

  for (const smell of result.smells) {
    lines.push(`- [${smell.severity}] ${smell.code}: ${smell.title}`);
    if (smell.category) {
      lines.push(`  Categoria: ${smell.category}`);
    }
    lines.push(`  Problema: ${smell.message}`);
    if (smell.whyItMatters) {
      lines.push(`  Por que importa: ${smell.whyItMatters}`);
    }
    lines.push(`  Sugestão: ${smell.suggestion}`);
    if (smell.rewritePlan && smell.rewritePlan.length > 0) {
      lines.push('  Plano de reescrita:');
      for (const step of smell.rewritePlan) {
        lines.push(`    - ${step}`);
      }
    }
    if (smell.safeAutoFix !== undefined) {
      lines.push(`  Auto-fix seguro: ${smell.safeAutoFix ? 'sim' : 'não'}`);
    }
    lines.push(`  Confiança: ${Math.round(smell.confidence * 100)}%`);
    lines.push('');
  }

  return lines.join('\n');
}
