import { QueryAnalysisRequest } from '../domain/query-analysis-request.js';
import { QueryAnalysisResult } from '../domain/query-analysis-result.js';
import { Severity } from '../domain/severity.js';
import { queryRules } from '../rules/index.js';

export class QueryAnalysisService {
  analyze(request: QueryAnalysisRequest): QueryAnalysisResult {
    const smells = queryRules.flatMap((rule) => rule.analyze(request));

    const severity = this.resolveSeverity(smells.map((item) => item.severity));

    return {
      summary: this.buildSummary(smells.length, severity),
      severity,
      smells,
      recommendations: smells.map((item) => item.suggestion),
      manualReviewRequired: smells.some((item) => item.severity === 'high' || item.confidence < 0.75)
    };
  }

  private resolveSeverity(severities: Severity[]): Severity {
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    if (severities.includes('low')) return 'low';
    return 'info';
  }

  private buildSummary(total: number, severity: Severity): string {
    if (total === 0) {
      return 'Nenhum problema óbvio de performance foi identificado pelas regras atuais.';
    }

    return `Foram encontrados ${total} ponto(s) de atenção. Severidade geral: ${severity}.`;
  }
}
