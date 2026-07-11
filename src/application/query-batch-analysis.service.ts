import type { AnalysisOptions } from '../domain/analysis-options.js';
import { BatchAnalysisRequest } from '../domain/batch-analysis-request.js';
import {
  BatchAnalysisResult,
  FileAnalysisResult
} from '../domain/batch-analysis-result.js';
import { QuerySmell } from '../domain/query-smell.js';
import { Severity } from '../domain/severity.js';
import { QueryAnalysisService } from './query-analysis.service.js';

const severityScore: Record<Severity, number> = {
  info: 1,
  low: 2,
  medium: 4,
  high: 7,
  critical: 10
};

const highImpactBonus: Record<string, number> = {
  FUNCTION_ON_COLUMN_FILTER: 4,
  TO_STRING_IN_QUERY_FILTER: 4,
  CONTAINS_ON_CONVERTED_VALUE: 4,
  AS_ENUMERABLE_BEFORE_QUERY_OPERATORS: 3,
  TO_LIST_BEFORE_WHERE: 3,
  TO_LIST_BEFORE_SKIP_TAKE: 3,
  LARGE_TAKE_WITH_ORDER_BY: 2,
  CLIENT_SIDE_METHOD_IN_WHERE: 2,
  MULTIPLE_COLLECTION_INCLUDES: 2,
  N_PLUS_ONE_QUERY_IN_LOOP: 5,
  MULTIPLE_ROUND_TRIPS_IN_LOOP: 5,
  CARTESIAN_PRODUCT_QUERY: 5,
  CORRELATED_SUBQUERY_IN_PROJECTION: 3,
  IMPLICIT_CONVERSION_IN_FILTER: 4,
  FULL_ENTITY_MATERIALIZATION: 2
};

export class QueryBatchAnalysisService {
  private readonly analysisService = new QueryAnalysisService();

  analyze(request: BatchAnalysisRequest, options?: AnalysisOptions): BatchAnalysisResult {
    const files = request.files ?? [];
    const results: FileAnalysisResult[] = [];

    for (const file of files) {
      options?.signal?.throwIfAborted();

      if (!this.hasValidPath(file.path)) {
        continue;
      }

      results.push(this.analyzeFile(file.path, file.content, request, options));
    }

    const sortedResults = results.sort((left, right) => right.score - left.score);
    const filesWithIssues = sortedResults.filter((result) => result.smellCount > 0).length;
    const highestSeverity = this.resolveHighestSeverity(sortedResults.map((result) => result.severity));
    const topRisks = sortedResults
      .filter((result) => result.score > 0 && result.smellCount > 0)
      .slice(0, 5);

    return {
      filesAnalyzed: sortedResults.length,
      filesWithIssues,
      highestSeverity,
      results: sortedResults,
      topRisks,
      summary: this.buildSummary(sortedResults.length, filesWithIssues, highestSeverity)
    };
  }

  private analyzeFile(
    path: string,
    content: string,
    request: BatchAnalysisRequest,
    options?: AnalysisOptions
  ): FileAnalysisResult {
    if (!content?.trim()) {
      return {
        path,
        severity: 'info',
        score: 0,
        smellCount: 0,
        highImpactSmells: [],
        smells: [],
        recommendations: [],
        manualReviewRequired: false
      };
    }

    const analysis = this.analysisService.analyze(
      {
        code: content,
        provider: request.provider,
        context: request.context,
        filePath: path
      },
      options
    );

    const score = this.calculateScore(analysis.smells);
    const highImpactSmells = this.resolveHighImpactSmells(analysis.smells);

    return {
      path,
      severity: analysis.severity,
      score,
      smellCount: analysis.smells.length,
      highImpactSmells,
      smells: analysis.smells,
      recommendations: analysis.recommendations,
      manualReviewRequired: analysis.manualReviewRequired,
      ...(analysis.truncated ? { truncated: true } : {})
    };
  }

  private calculateScore(smells: QuerySmell[]): number {
    const baseTotal = smells.reduce((total, smell) => {
      const baseScore = severityScore[smell.severity] ?? 0;
      const bonus = highImpactBonus[smell.code] ?? 0;

      return total + baseScore + bonus;
    }, 0);

    return baseTotal + this.calculateComboBonus(smells);
  }

  private calculateComboBonus(smells: QuerySmell[]): number {
    const codes = new Set(smells.map((smell) => smell.code));
    let bonus = 0;

    if (
      codes.has('CARTESIAN_PRODUCT_QUERY') &&
      codes.has('CORRELATED_SUBQUERY_IN_PROJECTION')
    ) {
      bonus += 8;
    }

    if (
      codes.has('FUNCTION_ON_COLUMN_FILTER') &&
      codes.has('CONTAINS_ON_CONVERTED_VALUE')
    ) {
      bonus += 6;
    }

    if (codes.has('AS_ENUMERABLE_BEFORE_QUERY_OPERATORS') && codes.has('LARGE_TAKE')) {
      bonus += 5;
    }

    const highImpactCount = smells.filter(
      (smell) =>
        smell.severity === 'critical' ||
        smell.severity === 'high' ||
        highImpactBonus[smell.code] !== undefined
    ).length;

    if (highImpactCount >= 3) {
      bonus += 5;
    }

    return bonus;
  }

  private resolveHighImpactSmells(smells: QuerySmell[]): string[] {
    return smells
      .filter(
        (smell) =>
          smell.severity === 'critical' ||
          smell.severity === 'high' ||
          highImpactBonus[smell.code] !== undefined
      )
      .map((smell) => smell.code);
  }

  private resolveHighestSeverity(severities: Severity[]): Severity {
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    if (severities.includes('low')) return 'low';

    return 'info';
  }

  private buildSummary(
    filesAnalyzed: number,
    filesWithIssues: number,
    highestSeverity: Severity
  ): string {
    if (filesAnalyzed === 0) {
      return 'No files were analyzed.';
    }

    if (filesWithIssues === 0) {
      return `Analyzed ${filesAnalyzed} file(s). No query performance smells were detected by the current rules.`;
    }

    return `Analyzed ${filesAnalyzed} file(s). Found issues in ${filesWithIssues} file(s). Highest severity: ${highestSeverity}.`;
  }

  private hasValidPath(path: string): boolean {
    return Boolean(path?.trim());
  }
}
