import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProjectStack } from "../../../src/core/project-stack/project-stack.service.js";
import { resolveSafePath, PathTraversalError } from "../../../src/shared/fs/safe-path.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../fixtures/dotnet-projects");

describe("project-stack.service", () => {
  it("should detect TargetFramework netcoreapp2.1", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-2-sqlserver");
    const stack = await analyzeProjectStack(projectPath);

    expect(stack.primaryTargetFramework).toBe("netcoreapp2.1");
    expect(stack.targetFrameworks).toContain("netcoreapp2.1");
  });

  it("should detect EF Core PackageReference", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-2-sqlserver");
    const stack = await analyzeProjectStack(projectPath);

    expect(stack.efKind).toBe("EFCore");
    expect(stack.efVersion).toBe("2.1.14");
    expect(stack.provider).toBe("SqlServer");
    expect(stack.providerFamily).toBe("Relational");
    expect(stack.providerSupportLevel).toBe("first_class");
  });

  it("should detect Dapper PackageReference", async () => {
    const projectPath = path.join(fixturesDir, "dapper-sqlserver");
    const stack = await analyzeProjectStack(projectPath);

    expect(stack.hasDapper).toBe(true);
    expect(stack.dapperVersion).toBe("2.1.35");
  });

  it("should not detect Dapper when not installed", async () => {
    const projectPath = path.join(fixturesDir, "no-dapper");
    const stack = await analyzeProjectStack(projectPath);

    expect(stack.hasDapper).toBe(false);
  });

  it("should block path traversal", () => {
    const projectPath = path.join(fixturesDir, "ef-core-2-sqlserver");
    expect(() => resolveSafePath(projectPath, "../../../etc/passwd")).toThrow(
      PathTraversalError,
    );
  });
});
