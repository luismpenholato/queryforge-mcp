import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { optimizeExistingQueryTool } from "../../src/mcp/tools/optimize-existing-query.mcp-tool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../fixtures/dotnet-projects");
const realWorldDir = path.join(fixturesDir, "real-world-queries");

function readMethodBody(fileName: string, methodName: string): string {
  const content = fs.readFileSync(path.join(realWorldDir, fileName), "utf-8");
  const signatureIndex = content.indexOf(methodName);
  if (signatureIndex === -1) {
    throw new Error(`Method ${methodName} not found in ${fileName}`);
  }
  const openBrace = content.indexOf("{", signatureIndex);
  let depth = 0;
  for (let i = openBrace; i < content.length; i++) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        return content.slice(signatureIndex, i + 1);
      }
    }
  }
  throw new Error(`Could not extract method ${methodName} from ${fileName}`);
}

describe("real-world query analysis", () => {
  it("should not emit optimizedEfCode in strict mode for complex grid query", async () => {
    const code = readMethodBody("GridRepository.cs", "GetGridAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    expect(result.mode).toBe("strict");
    expect(result.optimizedEfCode).toBeNull();
    expect(result.rewritePlan.length).toBeGreaterThan(0);
    expect(result.problems.some((p) => p.needsManualReview !== undefined)).toBe(true);
  });

  it("should return rewritePlan for dashboard query with multiple includes", async () => {
    const code = readMethodBody("DashboardRepository.cs", "GetDashboardAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    expect(result.rewritePlan.length).toBeGreaterThan(0);
    expect(result.optimizedEfCode).toBeNull();
    const includeSmell = result.problems.find((p) => p.type === "MULTIPLE_COLLECTION_INCLUDES");
    expect(includeSmell?.canAutoFix).toBe(false);
    expect(includeSmell?.needsManualReview).toBe(true);
  });

  it("should require manual review for report query with GroupBy navigation", async () => {
    const code = readMethodBody("ReportRepository.cs", "GetReportAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    expect(result.optimizedEfCode).toBeNull();
    expect(result.needsManualReview).toBe(true);
    expect(result.rewritePlan.length).toBeGreaterThan(0);
    expect(result.behaviorPreservation.behaviorRisk).not.toBe("none");
  });

  it("should not auto-fix large Contains", async () => {
    const code = readMethodBody("LargeContainsRepository.cs", "GetByIdsAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    const smell = result.problems.find((p) => p.type === "LARGE_CONTAINS_RISK");
    expect(smell?.canAutoFix).toBe(false);
    expect(smell?.needsManualReview).toBe(true);
    expect(result.optimizedEfCode).toBeNull();
  });

  it("should not auto-fix dynamic/custom method filters", async () => {
    const code = readMethodBody("DynamicFiltersRepository.cs", "GetAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    expect(result.problems.some((p) => p.type === "CUSTOM_METHOD_IN_WHERE")).toBe(true);
    expect(result.optimizedEfCode).toBeNull();
  });

  it("should not suggest AsSplitQuery rewrite auto-apply on EF Core 2.1", async () => {
    const code = readMethodBody("LegacyEfCore21Repository.cs", "GetLegacyAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-2-sqlserver"),
      code,
      mode: "strict",
    });

    const splitPlan = result.rewritePlan.find((p) => p.id === "consider-as-split-query");
    expect(splitPlan).toBeUndefined();
    const smell = result.problems.find((p) => p.type === "MULTIPLE_COLLECTION_INCLUDES");
    expect(smell?.suggestion).not.toMatch(/Consider AsSplitQuery/i);
    expect(result.optimizedEfCode).toBeNull();
  });

  it("should mention AsSplitQuery in plan for EF Core 6 multiple includes with manual review", async () => {
    const code = readMethodBody("MultipleIncludesRepository.cs", "GetAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    const smell = result.problems.find((p) => p.type === "MULTIPLE_COLLECTION_INCLUDES");
    expect(smell?.suggestion).toMatch(/AsSplitQuery/i);
    const splitPlan = result.rewritePlan.find((p) => p.id === "consider-as-split-query");
    expect(splitPlan).toBeDefined();
    expect(splitPlan?.safeToAutoApply).toBe(false);
    expect(splitPlan?.requiresManualReview).toBe(true);
  });

  it("should block relational suggestions for MongoDB provider", async () => {
    const code = readMethodBody("MongoRepository.cs", "GetAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "providers/mongodb"),
      code,
      mode: "strict",
    });

    expect(result.dapperAlternative.available).toBe(false);
    expect(result.indexSuggestions.length).toBe(0);
    expect(result.analysisMode).toBe("generic_conservative");
  });

  it("should not add AsNoTracking when SaveChanges is present", async () => {
    const code = readMethodBody("TrackingMutationRepository.cs", "UpdateCustomerNameAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "safe",
      rewriteCode: true,
    });

    const trackingSmell = result.problems.find((p) => p.type === "MISSING_AS_NO_TRACKING");
    if (trackingSmell) {
      expect(trackingSmell.canAutoFix).toBe(false);
    }
    expect(result.rewritePlan.find((p) => p.id === "add-as-no-tracking")?.safeToAutoApply).not.toBe(true);
  });

  it("should allow high-confidence optimizedEfCode only in safe mode for simple Count query", async () => {
    const code = readMethodBody("DapperReadOnlyRepository.cs", "HasOrdersAsync");
    const strict = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "dapper-sqlserver"),
      code,
      mode: "strict",
    });
    const safe = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "dapper-sqlserver"),
      code,
      mode: "safe",
      rewriteCode: true,
    });

    expect(strict.optimizedEfCode).toBeNull();
    expect(safe.rewritePlan.some((p) => p.id === "count-to-any")).toBe(true);
    if (safe.optimizedEfCode) {
      expect(safe.optimizedEfCode).toContain("AnyAsync");
    }
  });

  it("should expose per-smell confidence and canAutoFix metadata", async () => {
    const code = readMethodBody("DevExtremeDataSourceLoaderRepository.cs", "LoadAsync");
    const result = await optimizeExistingQueryTool({
      projectPath: path.join(fixturesDir, "ef-core-6-sqlserver"),
      code,
      mode: "strict",
    });

    expect(result.problems.length).toBeGreaterThan(0);
    for (const problem of result.problems) {
      expect(problem.confidence).toMatch(/low|medium|high/);
      expect(typeof problem.needsManualReview).toBe("boolean");
      expect(typeof problem.canAutoFix).toBe("boolean");
    }
  });
});
