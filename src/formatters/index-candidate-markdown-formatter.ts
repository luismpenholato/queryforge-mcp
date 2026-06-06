import { IndexCandidateResult } from '../domain/index-candidate-result.js';

export function formatIndexCandidatesAsMarkdown(result: IndexCandidateResult): string {
  const lines: string[] = [];

  lines.push('# QueryForge Index Candidates');
  lines.push('');
  lines.push(`Summary: ${result.summary}`);
  lines.push(`Database provider: ${result.databaseProvider}`);
  lines.push(`Table: ${result.tableName}`);
  lines.push('Manual review required: yes');
  lines.push('');

  if (result.analysisSmells.length > 0) {
    lines.push('Detected query smells:');
    lines.push(result.analysisSmells.map((smell) => `- ${smell}`).join('\n'));
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');

    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }

    lines.push('');
  }

  if (result.candidates.length === 0) {
    lines.push('No index candidates could be generated from the current heuristics.');
    lines.push('');
    lines.push('## Validation checklist');
    lines.push('');
    lines.push('- Check existing indexes before creating a new one.');
    lines.push('- Validate with the actual execution plan.');
    lines.push('- Validate read/write trade-offs.');
    lines.push('- Validate column selectivity and data distribution.');
    lines.push('- Do not add indexes blindly to write-heavy tables.');
    return lines.join('\n');
  }

  lines.push('## Candidates');
  lines.push('');

  result.candidates.forEach((candidate, index) => {
    const indexName = `IX_${candidate.tableName}_${candidate.columns.map((column) => column.name).join('_')}`;

    lines.push(`### ${index + 1}. ${indexName}`);
    lines.push('');
    lines.push(`Confidence: ${Math.round(candidate.confidence * 100)}%`);
    lines.push(`Table: ${candidate.tableName}`);
    lines.push('Columns:');

    for (const column of candidate.columns) {
      const direction = column.direction ? `, ${column.direction}` : '';
      lines.push(`- ${column.name} (${column.kind}${direction})`);
    }

    if (candidate.reasons.length > 0) {
      lines.push('');
      lines.push('Reasons:');

      for (const reason of candidate.reasons) {
        lines.push(`- ${reason}`);
      }
    }

    if (candidate.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');

      for (const warning of candidate.warnings) {
        lines.push(`- ${warning}`);
      }
    }

    if (candidate.sql) {
      lines.push('');
      lines.push('SQL:');
      lines.push('');
      lines.push('```sql');
      lines.push(candidate.sql);
      lines.push('```');
    }

    lines.push('');
  });

  lines.push('## Validation checklist');
  lines.push('');
  lines.push('- Check existing indexes before creating a new one.');
  lines.push('- Validate with the actual execution plan.');
  lines.push('- Validate read/write trade-offs.');
  lines.push('- Validate column selectivity and data distribution.');
  lines.push('- Do not add indexes blindly to write-heavy tables.');

  return lines.join('\n');
}
