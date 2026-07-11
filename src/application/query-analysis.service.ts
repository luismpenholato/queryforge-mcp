import type { AnalysisOptions } from '../domain/analysis-options.js';
import type { QueryAnalysisRequest } from '../domain/query-analysis-request.js';
import type { QueryAnalysisResult } from '../domain/query-analysis-result.js';
import type { QuerySmell } from '../domain/query-smell.js';
import { deriveSafeAutoFix, withSafeAutoFix } from '../domain/query-smell.js';
import type { Severity } from '../domain/severity.js';
import { computeDiagnosticFingerprint } from './diagnostic-fingerprint.js';
import { queryRules } from '../rules/index.js';

const MIN_MAX_ISSUES = 1;

export class QueryAnalysisService {
  analyze(request: QueryAnalysisRequest, options?: AnalysisOptions): QueryAnalysisResult {
    const maxIssues = this.resolveMaxIssues(options?.maxIssues);
    const smells: QuerySmell[] = [];
    let truncated = false;

    for (const rule of queryRules) {
      options?.signal?.throwIfAborted();

      const ruleSmells = rule.analyze(request).map((smell) => this.enrichSmell(smell, request));

      for (const smell of ruleSmells) {
        if (smells.length >= maxIssues) {
          truncated = true;
          break;
        }

        smells.push(smell);
      }

      if (truncated) {
        break;
      }
    }

    const severity = this.resolveSeverity(smells.map((item) => item.severity));

    return {
      summary: this.buildSummary(smells.length, severity),
      severity,
      smells,
      recommendations: smells.map((item) => item.suggestion),
      manualReviewRequired: smells.some(
        (item) => item.severity === 'critical' || item.severity === 'high' || item.confidence < 0.75
      ),
      ...(truncated ? { truncated: true } : {})
    };
  }

  private enrichSmell(smell: QuerySmell, request: QueryAnalysisRequest): QuerySmell {
    const enriched = withSafeAutoFix({
      ...smell,
      fingerprint: computeDiagnosticFingerprint({
        filePath: request.filePath,
        ruleCode: smell.code,
        range: smell.range,
        matchedText: smell.range ? request.code.slice(smell.range.start, smell.range.end) : undefined
      })
    });

    if (enriched.safeAutoFix !== true && smell.safeAutoFix === true && !deriveSafeAutoFix(enriched)) {
      return { ...enriched, safeAutoFix: false };
    }

    return enriched;
  }

  private resolveMaxIssues(maxIssues?: number): number {
    if (maxIssues === undefined) {
      return Number.POSITIVE_INFINITY;
    }

    if (!Number.isFinite(maxIssues) || maxIssues < MIN_MAX_ISSUES) {
      throw new Error(`maxIssues must be a finite number greater than or equal to ${MIN_MAX_ISSUES}.`);
    }

    return Math.floor(maxIssues);
  }

  private resolveSeverity(severities: Severity[]): Severity {
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    if (severities.includes('low')) return 'low';
    return 'info';
  }

  private buildSummary(total: number, severity: Severity): string {
    if (total === 0) {
      return 'No obvious query performance issues were identified by the current rules.';
    }

    const issueLabel = total === 1 ? 'issue' : 'issues';
    return `Found ${total} potential query performance ${issueLabel}. Overall severity: ${severity}.`;
  }
}
