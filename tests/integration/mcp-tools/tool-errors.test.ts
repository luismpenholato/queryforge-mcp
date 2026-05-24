import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseOptimizeExistingQueryInput } from "../../../src/mcp/tools/optimize-existing-query.mcp-tool.js";
import { parseInspectProjectStackInput } from "../../../src/mcp/tools/inspect-project-stack.mcp-tool.js";
import { formatToolError } from "../../../src/mcp/format-tool-error.js";
import { inspectProjectStackTool } from "../../../src/mcp/tools/inspect-project-stack.mcp-tool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../fixtures/dotnet-projects");

describe("MCP tool friendly errors", () => {
  it("should reject empty code with friendly message", () => {
    try {
      parseOptimizeExistingQueryInput({
        projectPath: fixturesDir,
        code: "",
      });
      expect.fail("Expected validation error");
    } catch (error) {
      expect(formatToolError(error)).toContain("Query code cannot be empty");
      expect(formatToolError(error)).not.toContain("ZodError");
    }
  });

  it("should reject missing project path", () => {
    try {
      parseInspectProjectStackInput({ projectPath: "" });
      expect.fail("Expected validation error");
    } catch (error) {
      expect(formatToolError(error)).toContain("projectPath is required");
    }
  });

  it("should reject non-existent project path", async () => {
    try {
      await inspectProjectStackTool("/path/that/does/not/exist/queryforge");
      expect.fail("Expected project path error");
    } catch (error) {
      expect(formatToolError(error)).toContain("Project path does not exist");
      expect(formatToolError(error)).not.toMatch(/\n\s+at /);
    }
  });

  it("should reject unknown provider override", () => {
    try {
      parseOptimizeExistingQueryInput({
        projectPath: fixturesDir,
        code: "return await _context.Orders.ToListAsync();",
        provider: "DefinitelyNotAProvider",
      });
      expect.fail("Expected validation error");
    } catch (error) {
      expect(formatToolError(error)).toContain("Unknown provider");
    }
  });

  it("should reject directory without csproj for optimize flow", async () => {
    const emptyDir = path.join(__dirname, "../../fixtures/empty-dir");
    const fs = await import("node:fs/promises");
    await fs.mkdir(emptyDir, { recursive: true });

    const { optimizeExistingQueryTool } = await import(
      "../../../src/mcp/tools/optimize-existing-query.mcp-tool.js"
    );

    try {
      await optimizeExistingQueryTool({
        projectPath: emptyDir,
        code: "return await _context.Orders.ToListAsync();",
      });
      expect.fail("Expected missing csproj error");
    } catch (error) {
      expect(formatToolError(error)).toContain("No .csproj files found");
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });
});
