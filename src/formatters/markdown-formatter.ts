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
    lines.push(`  Problema: ${smell.message}`);
    lines.push(`  Sugestão: ${smell.suggestion}`);
    lines.push(`  Confiança: ${Math.round(smell.confidence * 100)}%`);
    lines.push('');
  }

  return lines.join('\n');
}
