import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeDapperAvailability } from "../../../src/core/dapper/dapper-detector.js";
import { analyzeProjectStack } from "../../../src/core/project-stack/project-stack.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../fixtures/dotnet-projects");

describe("dapper-detector", () => {
  it("should mark Dapper as requiresNewDependency when not installed", async () => {
    const projectPath = path.join(fixturesDir, "no-dapper");
    const stack = await analyzeProjectStack(projectPath);
    const availability = await analyzeDapperAvailability(projectPath, stack);

    expect(availability.hasDapperPackage).toBe(false);
    expect(availability.requiresNewDependency).toBe(true);
  });

  it("should detect Dapper usage in source files", async () => {
    const projectPath = path.join(fixturesDir, "dapper-sqlserver");
    const stack = await analyzeProjectStack(projectPath);
    const availability = await analyzeDapperAvailability(projectPath, stack);

    expect(availability.hasDapperPackage).toBe(true);
    expect(availability.hasUsingDapper).toBe(true);
    expect(availability.hasQueryAsyncUsage).toBe(true);
    expect(availability.requiresNewDependency).toBe(false);
  });
});
