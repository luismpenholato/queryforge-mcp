import { IndexCandidateResult } from '../domain/index-candidate-result.js';
import { IndexCandidate } from '../domain/index-candidate.js';

function formatCandidateBlock(candidate: IndexCandidate, index: number): string[] {
  const lines: string[] = [];
  const indexName = `IX_${candidate.tableName}_${candidate.columns.map((column) => column.name).join('_')}`;

  lines.push(`### ${index + 1}. ${indexName}`);
  lines.push('');
  lines.push(`Confidence: ${Math.round(candidate.confidence * 100)}%`);
  lines.push(`Table: ${candidate.tableName}`);

  if (candidate.requiresQueryRewrite) {
    lines.push('Requires query rewrite before this index can be useful: yes');

    if (candidate.rewriteRequiredReason) {
      lines.push(`Rewrite reason: ${candidate.rewriteRequiredReason}`);
    }
  }

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
  return lines;
}

function formatPostRewriteNotes(notes: string[]): string[] {
  const lines: string[] = [];

  for (const note of notes) {
    if (note.startsWith('CREATE INDEX') || note.startsWith('-- Generic')) {
      lines.push('```sql');
      lines.push(note);
      lines.push('```');
      lines.push('');
      continue;
    }

    lines.push(note);
    lines.push('');
  }

  return lines;
}

export function formatIndexCandidatesAsMarkdown(result: IndexCandidateResult): string {
  const lines: string[] = [];
  const hasRewriteContext =
    result.candidates.some((candidate) => candidate.requiresQueryRewrite) ||
    (result.postRewriteEvaluation?.length ?? 0) > 0;

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
    lines.push('No safe direct index candidate was generated from the current heuristics.');
    lines.push('');

    if (result.notRecommendedNotes && result.notRecommendedNotes.length > 0) {
      lines.push('## Not recommended / not solved by normal B-tree index');
      lines.push('');

      for (const note of result.notRecommendedNotes) {
        lines.push(`- ${note}`);
      }

      lines.push('');
    }

    lines.push('## Validation checklist');
    lines.push('');
    lines.push('- Check existing indexes before creating a new one.');
    lines.push('- Validate with the actual execution plan.');
    lines.push('- Validate read/write trade-offs.');
    lines.push('- Validate column selectivity and data distribution.');
    lines.push('- Do not add indexes blindly to write-heavy tables.');
    return lines.join('\n');
  }

  lines.push('## Current query candidate');
  lines.push('');

  if (hasRewriteContext) {
    lines.push(
      'Conditional candidate for the current query shape. Limited index benefit until non-sargable filters are rewritten.'
    );
    lines.push('');
  }

  result.candidates.forEach((candidate, index) => {
    lines.push(...formatCandidateBlock(candidate, index));
  });

  if (result.postRewriteEvaluation && result.postRewriteEvaluation.length > 0) {
    lines.push('## Post-rewrite candidate');
    lines.push('');
    lines.push(
      'Evaluate these candidates only after rewriting non-sargable filters to range or typed comparisons.'
    );
    lines.push('');
    lines.push(...formatPostRewriteNotes(result.postRewriteEvaluation));
  }

  if (result.notRecommendedNotes && result.notRecommendedNotes.length > 0) {
    lines.push('## Not recommended / not solved by normal B-tree index');
    lines.push('');

    for (const note of result.notRecommendedNotes) {
      lines.push(`- ${note}`);
    }

    lines.push('');
  }

  lines.push('## Validation checklist');
  lines.push('');
  lines.push('- Check existing indexes before creating a new one.');
  lines.push('- Validate with the actual execution plan.');
  lines.push('- Validate read/write trade-offs.');
  lines.push('- Validate column selectivity and data distribution.');
  lines.push('- Do not add indexes blindly to write-heavy tables.');

  return lines.join('\n');
}
