import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryAnalysisService } from '../application/query-analysis.service.js';
import { ReviewReportService } from '../application/review-report.service.js';

export function registerGenerateReviewReportTool(server: McpServer): void {
  const analysisService = new QueryAnalysisService();
  const reportService = new ReviewReportService();

  server.tool(
    'generate_review_report',
    'Generate a markdown review report for a C# query.',
    {
      code: z.string().describe('C# query code to analyze.'),
      provider: z.enum(['ef-core', 'linq', 'dapper', 'unknown']).optional(),
      context: z.string().optional()
    },
    async ({ code, provider, context }) => {
      const analysis = analysisService.analyze({
        code,
        provider,
        context
      });

      const report = reportService.generate(analysis);

      return {
        content: [
          {
            type: 'text',
            text: report
          }
        ]
      };
    }
  );
}
