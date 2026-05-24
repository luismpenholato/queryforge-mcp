import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { formatToolError } from "./format-tool-error.js";
import { inspectProjectStackToolDefinition } from "./schemas/inspect-project-stack.schema.js";
import { optimizeExistingQueryToolDefinition } from "./schemas/optimize-existing-query.schema.js";
import { suggestDapperAlternativeToolDefinition } from "./schemas/suggest-dapper-alternative.schema.js";
import { compareEfVsDapperToolDefinition } from "./schemas/compare-ef-vs-dapper.schema.js";
import { suggestIndexesToolDefinition } from "./schemas/suggest-indexes.schema.js";
import {
  inspectProjectStackTool,
  parseInspectProjectStackInput,
} from "./tools/inspect-project-stack.mcp-tool.js";
import {
  optimizeExistingQueryTool,
  parseOptimizeExistingQueryInput,
} from "./tools/optimize-existing-query.mcp-tool.js";
import {
  suggestDapperAlternativeTool,
  parseSuggestDapperAlternativeInput,
} from "./tools/suggest-dapper-alternative.mcp-tool.js";
import {
  compareEfVsDapperTool,
  parseCompareEfVsDapperInput,
} from "./tools/compare-ef-vs-dapper.mcp-tool.js";
import {
  suggestIndexesMcpTool,
  parseSuggestIndexesInput,
} from "./tools/suggest-indexes.mcp-tool.js";

export function formatToolResponse(data: unknown, markdown?: string) {
  const parts: Array<{ type: "text"; text: string }> = [
    { type: "text", text: JSON.stringify(data, null, 2) },
  ];

  if (markdown) {
    parts.push({ type: "text", text: markdown });
  }

  return { content: parts };
}

export function registerTools(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      inspectProjectStackToolDefinition,
      optimizeExistingQueryToolDefinition,
      suggestDapperAlternativeToolDefinition,
      compareEfVsDapperToolDefinition,
      suggestIndexesToolDefinition,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "inspect_project_stack": {
          const input = parseInspectProjectStackInput(args);
          const result = await inspectProjectStackTool(input.projectPath);
          return formatToolResponse(result);
        }

        case "optimize_existing_query": {
          const input = parseOptimizeExistingQueryInput(args);
          const result = await optimizeExistingQueryTool(input);
          return formatToolResponse(result, result.markdownSummary);
        }

        case "suggest_dapper_alternative": {
          const input = parseSuggestDapperAlternativeInput(args);
          const result = await suggestDapperAlternativeTool(input);
          return formatToolResponse(result);
        }

        case "compare_ef_vs_dapper": {
          const input = parseCompareEfVsDapperInput(args);
          const result = await compareEfVsDapperTool(input);
          return formatToolResponse(result);
        }

        case "suggest_indexes": {
          const input = parseSuggestIndexesInput(args);
          const result = suggestIndexesMcpTool(input);
          return formatToolResponse(result);
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${formatToolError(error)}` }],
        isError: true,
      };
    }
  });
}
