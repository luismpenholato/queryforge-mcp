import { BatchAnalysisResult } from '../domain/batch-analysis-result.js';

export function formatBatchAnalysisAsMarkdown(result: BatchAnalysisResult): string {
  const lines: string[] = [];

  lines.push('# QueryForge Batch Analysis');
  lines.push('');
  lines.push(`Summary: ${result.summary}`);
  lines.push('');
  lines.push(`Files analyzed: ${result.filesAnalyzed}`);
  lines.push(`Files with issues: ${result.filesWithIssues}`);
  lines.push(`Highest severity: ${result.highestSeverity}`);
  lines.push('');

  if (result.topRisks.length === 0) {
    lines.push('No risky files were found by the current rules.');
    return lines.join('\n');
  }

  lines.push('## Top risky files');
  lines.push('');

  result.topRisks.forEach((file, index) => {
    lines.push(`### ${index + 1}. ${file.path}`);
    lines.push('');
    lines.push(`- Severity: ${file.severity}`);
    lines.push(`- Score: ${file.score}`);
    lines.push(`- Smells: ${file.smellCount}`);
    lines.push(`- Manual review required: ${file.manualReviewRequired ? 'yes' : 'no'}`);

    if (file.highImpactSmells.length > 0) {
      lines.push(`- High impact smells: ${file.highImpactSmells.join(', ')}`);
    }

    const mainSmells = file.smells.slice(0, 6);

    if (mainSmells.length > 0) {
      lines.push('');
      lines.push('Main findings:');

      for (const smell of mainSmells) {
        lines.push(`- [${smell.severity}] ${smell.code}: ${smell.title}`);
      }
    }

    const recommendations = file.recommendations.slice(0, 4);

    if (recommendations.length > 0) {
      lines.push('');
      lines.push('Recommendations:');

      for (const recommendation of recommendations) {
        lines.push(`- ${recommendation}`);
      }
    }

    lines.push('');
  });

  lines.push('## Review order');
  lines.push('');
  lines.push('1. Review high/critical non-sargable filters first.');
  lines.push('2. Review premature materialization before filters, ordering or pagination.');
  lines.push('3. Review large ordered result sets.');
  lines.push('4. Apply safe read-only optimizations such as AsNoTracking where appropriate.');
  lines.push('');
  lines.push('Note: QueryForge uses heuristic analysis and does not replace execution plan validation.');

  return lines.join('\n');
}
