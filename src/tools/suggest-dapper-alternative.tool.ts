import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryAnalysisService } from '../application/query-analysis.service.js';
import { DapperSuggestionService } from '../application/dapper-suggestion.service.js';

export function registerSuggestDapperAlternativeTool(server: McpServer): void {
  const analysisService = new QueryAnalysisService();
  const dapperService = new DapperSuggestionService();

  server.tool(
    'suggest_dapper_alternative',
    'Suggest a conservative Dapper alternative for a read-only EF Core/LINQ query.',
    {
      code: z.string().describe('C# EF Core/LINQ query code.'),
      context: z.string().optional()
    },
    async ({ code, context }) => {
      const analysis = analysisService.analyze({
        code,
        provider: 'ef-core',
        context
      });

      const suggestion = dapperService.suggest(code, analysis);

      return {
        content: [
          {
            type: 'text',
            text: suggestion
          }
        ]
      };
    }
  );
}
