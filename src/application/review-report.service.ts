import { QueryAnalysisResult } from '../domain/query-analysis-result.js';

export class ReviewReportService {
  generate(analysis: QueryAnalysisResult): string {
    const lines: string[] = [];

    lines.push('# QueryForge Review');
    lines.push('');
    lines.push(`**Resumo:** ${analysis.summary}`);
    lines.push(`**Severidade:** ${analysis.severity}`);
    lines.push(`**Revisão manual necessária:** ${analysis.manualReviewRequired ? 'Sim' : 'Não'}`);
    lines.push('');

    if (analysis.smells.length === 0) {
      lines.push('Nenhum ponto de atenção encontrado pelas regras atuais.');
      return lines.join('\n');
    }

    lines.push('## Pontos encontrados');
    lines.push('');

    for (const smell of analysis.smells) {
      lines.push(`### ${smell.code} — ${smell.title}`);
      lines.push('');
      lines.push(`- **Severidade:** ${smell.severity}`);
      lines.push(`- **Confiança:** ${Math.round(smell.confidence * 100)}%`);
      lines.push(`- **Problema:** ${smell.message}`);
      lines.push(`- **Sugestão:** ${smell.suggestion}`);
      lines.push('');
    }

    lines.push('## Checklist de validação');
    lines.push('');
    lines.push('- Validar SQL gerado pelo EF Core.');
    lines.push('- Confirmar se a mudança não altera tracking esperado.');
    lines.push('- Confirmar ordenação em paginações.');
    lines.push('- Rodar testes automatizados.');
    lines.push('- Comparar performance com dados reais quando possível.');

    return lines.join('\n');
  }
}
