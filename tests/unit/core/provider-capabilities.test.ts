import { describe, expect, it } from "vitest";
import { analyzeQuery } from "../../../src/core/query-analysis/query-analysis.service.js";
import { suggestDapperQuery } from "../../../src/core/dapper/dapper-suggestion.service.js";
import { suggestIndexes } from "../../../src/core/indexes/index-suggestion.service.js";
import type { ProjectStack } from "../../../src/core/project-stack/project-stack.types.js";

const includeQuery = `
public async Task<List<OrderDto>> GetOrders()
{
    return await _context.Orders
        .Include(x => x.Items)
        .Include(x => x.Customer)
        .Where(x => x.Active)
        .Select(x => new OrderDto { Id = x.Id, CustomerName = x.Customer.Name })
        .ToListAsync();
}`;

const readOnlyQuery = `
public async Task<List<OrderDto>> GetOrders()
{
    return await _context.Orders
        .Where(x => x.Active)
        .Select(x => new OrderDto { Id = x.Id })
        .ToListAsync();
}`;

function createStack(overrides: Partial<ProjectStack>): ProjectStack {
  return {
    projectPath: "",
    projects: [],
    targetFrameworks: ["net8.0"],
    primaryTargetFramework: "net8.0",
    csharpVersion: "12.0",
    efKind: "EFCore",
    efVersion: "8.0.0",
    provider: "SqlServer",
    providerFamily: "Relational",
    providerSupportLevel: "first_class",
    providerConfidence: "high",
    providerWarnings: [],
    detectedProviderPackages: [],
    hasDapper: true,
    dapperVersion: "2.1.35",
    limitations: [],
    supportedOptimizations: [],
    warnings: [],
    ...overrides,
  };
}

describe("provider capabilities", () => {
  it("should block Dapper automatically for Custom provider", () => {
    const stack = createStack({
      provider: "Custom",
      providerFamily: "Custom",
      providerSupportLevel: "custom",
      providerPackageName: "Contoso.EntityFrameworkCore.WidgetStore",
      providerWarnings: [
        "Custom or unknown EF provider detected. QueryForge will apply only generic LINQ/EF analysis.",
      ],
    });
    const analysis = analyzeQuery(readOnlyQuery, stack);
    const result = suggestDapperQuery(readOnlyQuery, analysis, stack, {
      hasDapper: true,
      onlyIfDapperExists: false,
    });

    expect(result.available).toBe(false);
    expect(result.recommended).toBe(false);
    expect(result.needsManualReview).toBe(true);
  });

  it("should block Dapper and CREATE INDEX SQL for MongoDB", () => {
    const stack = createStack({
      provider: "MongoDB",
      providerFamily: "Document",
      providerSupportLevel: "supported",
      providerWarnings: ["MongoDB EF provider uses document queries."],
    });
    const analysis = analyzeQuery(readOnlyQuery, stack);
    const dapper = suggestDapperQuery(readOnlyQuery, analysis, stack, {
      hasDapper: true,
      onlyIfDapperExists: false,
    });
    const indexes = suggestIndexes({
      provider: "MongoDB",
      code: readOnlyQuery,
      projectStack: stack,
    });

    expect(dapper.available).toBe(false);
    expect(dapper.sql).toBeUndefined();
    expect(indexes.every((i) => !/^CREATE\s+INDEX/i.test(i.sql.trim()))).toBe(true);
    expect(analysis.analysisMode).toBe("generic_conservative");
  });

  it("should not treat Include as relational join for MongoDB", () => {
    const stack = createStack({
      provider: "MongoDB",
      providerFamily: "Document",
      providerSupportLevel: "supported",
    });
    const analysis = analyzeQuery(includeQuery, stack);

    expect(analysis.smells.some((s) => s.type === "MULTIPLE_COLLECTION_INCLUDES")).toBe(false);
    expect(
      analysis.smells.every(
        (s) =>
          !s.message.toLowerCase().includes("cartesian explosion") &&
          !s.impact.toLowerCase().includes("relational join") &&
          !s.suggestion.toLowerCase().includes("split quer"),
      ),
    ).toBe(true);
  });

  it("should block Dapper and CREATE INDEX SQL for Cosmos", () => {
    const stack = createStack({
      provider: "Cosmos",
      providerFamily: "Document",
      providerSupportLevel: "supported",
    });
    const analysis = analyzeQuery(readOnlyQuery, stack);
    const dapper = suggestDapperQuery(readOnlyQuery, analysis, stack, {
      hasDapper: true,
      onlyIfDapperExists: false,
    });
    const indexes = suggestIndexes({
      provider: "Cosmos",
      code: readOnlyQuery,
      projectStack: stack,
    });

    expect(dapper.available).toBe(false);
    expect(indexes.every((i) => !/^CREATE\s+INDEX/i.test(i.sql.trim()))).toBe(true);
    expect(indexes.some((i) => i.sql.includes("indexing policy"))).toBe(true);
    expect(analysis.analysisMode).toBe("generic_conservative");
  });

  it("should return InMemory performance warning and no index suggestions", () => {
    const stack = createStack({
      provider: "InMemory",
      providerFamily: "InMemory",
      providerSupportLevel: "supported",
      providerWarnings: ["InMemory provider does not represent real database query performance."],
    });
    const indexes = suggestIndexes({
      provider: "InMemory",
      code: readOnlyQuery,
      projectStack: stack,
    });

    expect(indexes).toHaveLength(0);
    expect(
      stack.providerWarnings.some((w) => w.includes("does not represent real database")),
    ).toBe(true);
  });

  it("should apply generic-only rules for Unknown provider", () => {
    const stack = createStack({
      provider: "Unknown",
      providerFamily: "Unknown",
      providerSupportLevel: "unknown",
      providerConfidence: "low",
      providerWarnings: [
        "No EF database provider was detected. QueryForge will apply only generic analysis.",
      ],
    });
    const analysis = analyzeQuery(readOnlyQuery, stack);
    const dapper = suggestDapperQuery(readOnlyQuery, analysis, stack, {
      hasDapper: true,
      onlyIfDapperExists: false,
    });
    const indexes = suggestIndexes({
      provider: "Unknown",
      code: readOnlyQuery,
      projectStack: stack,
    });

    expect(dapper.available).toBe(false);
    expect(dapper.sql).toBeUndefined();
    expect(indexes).toHaveLength(0);
    expect(analysis.analysisMode).toBe("generic_conservative");
  });

  it("should mark Custom provider optimization as conservative generic analysis", () => {
    const stack = createStack({
      provider: "Custom",
      providerFamily: "Custom",
      providerSupportLevel: "custom",
    });

    const analysis = analyzeQuery(readOnlyQuery, stack);
    expect(analysis.analysisMode).toBe("generic_conservative");
    expect(
      analysis.smells.every((s) => !s.suggestion.includes("TVP") && !s.suggestion.includes("temp table")),
    ).toBe(true);
  });
});

describe("provider capabilities integration", () => {
  it("should not use InMemory as real performance basis in optimize result", () => {
    const stack = createStack({
      provider: "InMemory",
      providerFamily: "InMemory",
      providerSupportLevel: "supported",
    });

    const analysis = analyzeQuery(readOnlyQuery, stack);
    expect(analysis.analysisMode).toBe("generic_conservative");
  });
});
