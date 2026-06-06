import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryAnalysisService } from '../application/query-analysis.service.js';
import { EfRewriteService } from '../application/ef-rewrite.service.js';

export function registerSuggestEfRewriteTool(server: McpServer): void {
  const analysisService = new QueryAnalysisService();
  const rewriteService = new EfRewriteService();

  server.tool(
    'suggest_ef_rewrite',
    'Suggest a safer EF Core rewrite for a C# query without modifying files.',
    {
      code: z.string().describe('C# EF Core query code to rewrite.'),
      context: z.string().optional()
    },
    async ({ code, context }) => {
      const analysis = analysisService.analyze({
        code,
        provider: 'ef-core',
        context
      });

      const rewrittenCode = rewriteService.suggest(code, analysis);

      return {
        content: [
          {
            type: 'text',
            text: rewrittenCode
          }
        ]
      };
    }
  );
}
