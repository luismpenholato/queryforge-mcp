import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAnalyzeQueryTool } from './tools/analyze-query.tool.js';
import { registerAnalyzeQueryBatchTool } from './tools/analyze-query-batch.tool.js';
import { registerSuggestEfRewriteTool } from './tools/suggest-ef-rewrite.tool.js';
import { registerSuggestDapperAlternativeTool } from './tools/suggest-dapper-alternative.tool.js';
import { registerGenerateReviewReportTool } from './tools/generate-review-report.tool.js';
import { registerInspectProjectStackTool } from './tools/inspect-project-stack.tool.js';
import { registerSuggestIndexCandidatesTool } from './tools/suggest-index-candidates.tool.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'queryforge-mcp',
    version: '0.6.2'
  });

  registerInspectProjectStackTool(server);
  registerAnalyzeQueryTool(server);
  registerAnalyzeQueryBatchTool(server);
  registerSuggestEfRewriteTool(server);
  registerSuggestDapperAlternativeTool(server);
  registerSuggestIndexCandidatesTool(server);
  registerGenerateReviewReportTool(server);

  return server;
}
