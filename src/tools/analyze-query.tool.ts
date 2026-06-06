import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryAnalysisService } from '../application/query-analysis.service.js';
import { formatAnalysisAsMarkdown } from '../formatters/markdown-formatter.js';

export function registerAnalyzeQueryTool(server: McpServer): void {
  const service = new QueryAnalysisService();

  server.tool(
    'analyze_query',
    'Analyze a C# EF Core, LINQ or Dapper query and return performance review suggestions.',
    {
      code: z.string().describe('C# query code to analyze.'),
      provider: z.enum(['ef-core', 'linq', 'dapper', 'unknown']).optional(),
      context: z.string().optional().describe('Optional context, for example read-only, report query, API endpoint, grid pagination.')
    },
    async ({ code, provider, context }) => {
      const result = service.analyze({ code, provider, context });

      return {
        content: [
          {
            type: 'text',
            text: formatAnalysisAsMarkdown(result)
          }
        ]
      };
    }
  );
}
