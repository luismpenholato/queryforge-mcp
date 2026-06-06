import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProjectStackService } from '../application/project-stack.service.js';

export function registerInspectProjectStackTool(server: McpServer): void {
  const service = new ProjectStackService();

  server.tool(
    'inspect_project_stack',
    'Inspect pasted .csproj content to detect .NET runtime, EF/Dapper usage, and database providers.',
    {
      projectFileContent: z.string().describe('Pasted .csproj file content.'),
      programFileContent: z.string().optional().describe('Optional Program.cs content for future hints.'),
      startupFileContent: z.string().optional().describe('Optional Startup.cs content for future hints.')
    },
    async ({ projectFileContent, programFileContent, startupFileContent }) => {
      const result = service.inspect({
        projectFileContent,
        programFileContent,
        startupFileContent
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );
}
