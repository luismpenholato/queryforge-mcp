import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IndexCandidateService } from '../application/index-candidate.service.js';
import { formatIndexCandidatesAsMarkdown } from '../formatters/index-candidate-markdown-formatter.js';

export function registerSuggestIndexCandidatesTool(server: McpServer): void {
  const service = new IndexCandidateService();

  server.tool(
    'suggest_index_candidates',
    'Suggest conservative index candidates from C# LINQ/EF query filters and ordering. Does not inspect the database or validate execution plans.',
    {
      code: z.string().min(1).describe('C# LINQ/EF query code to analyze.'),
      databaseProvider: z
        .enum([
          'sql-server',
          'mysql',
          'mariadb',
          'postgresql',
          'sqlite',
          'oracle',
          'cosmos',
          'mongodb',
          'in-memory',
          'unknown'
        ])
        .optional(),
      tableName: z.string().optional().describe('Optional explicit table name.'),
      context: z.string().optional()
    },
    async ({ code, databaseProvider, tableName, context }) => {
      const result = service.suggest({
        code,
        databaseProvider,
        tableName,
        context
      });

      return {
        content: [
          {
            type: 'text',
            text: formatIndexCandidatesAsMarkdown(result)
          }
        ]
      };
    }
  );
}
