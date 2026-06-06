import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAnalyzeQueryTool } from './tools/analyze-query.tool.js';
import { registerSuggestEfRewriteTool } from './tools/suggest-ef-rewrite.tool.js';
import { registerSuggestDapperAlternativeTool } from './tools/suggest-dapper-alternative.tool.js';
import { registerGenerateReviewReportTool } from './tools/generate-review-report.tool.js';
import { registerInspectProjectStackTool } from './tools/inspect-project-stack.tool.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'queryforge-mcp',
    version: '0.2.1'
  });

  registerAnalyzeQueryTool(server);
  registerSuggestEfRewriteTool(server);
  registerSuggestDapperAlternativeTool(server);
  registerGenerateReviewReportTool(server);
  registerInspectProjectStackTool(server);

  return server;
}
