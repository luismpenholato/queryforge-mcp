import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryBatchAnalysisService } from '../application/query-batch-analysis.service.js';
import { formatBatchAnalysisAsMarkdown } from '../formatters/batch-analysis-markdown-formatter.js';

export function registerAnalyzeQueryBatchTool(server: McpServer): void {
  const service = new QueryBatchAnalysisService();

  server.tool(
    'analyze_query_batch',
    'Analyze multiple C# query files/snippets and rank the riskiest ones by performance smells.',
    {
      files: z
        .array(
          z.object({
            path: z.string().min(1).describe('File path or logical name.'),
            content: z.string().describe('C# file or query snippet content.')
          })
        )
        .min(1)
        .describe('Files or snippets to analyze.'),
      provider: z.enum(['ef-core', 'ef6', 'linq', 'dapper', 'unknown']).optional(),
      context: z.string().optional()
    },
    async ({ files, provider, context }) => {
      const result = service.analyze({
        files,
        provider,
        context
      });

      return {
        content: [
          {
            type: 'text',
            text: formatBatchAnalysisAsMarkdown(result)
          }
        ]
      };
    }
  );
}
