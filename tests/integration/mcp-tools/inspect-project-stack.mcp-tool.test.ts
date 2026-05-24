import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inspectProjectStackTool } from "../../../src/mcp/tools/inspect-project-stack.mcp-tool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../fixtures/dotnet-projects");

describe("inspect-project-stack mcp tool", () => {
  it("should return structured stack output", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-2-sqlserver");
    const result = await inspectProjectStackTool(projectPath);

    expect(result.primaryTargetFramework).toBe("netcoreapp2.1");
    expect(result.efKind).toBe("EFCore");
    expect(result.provider).toBe("SqlServer");
    expect(result.providerFamily).toBe("Relational");
    expect(result.detectedProviderPackages.length).toBeGreaterThan(0);
    expect(result.hasDapper).toBe(true);
    expect(result.supportedOptimizations).toContain("AsNoTracking");
    expect(result.limitations.some((l) => l.includes("AsSplitQuery"))).toBe(true);
  });
});
