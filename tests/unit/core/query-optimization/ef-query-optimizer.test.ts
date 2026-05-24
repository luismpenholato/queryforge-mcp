import { describe, expect, it } from "vitest";
import { analyzeQuery } from "../../../../src/core/query-analysis/query-analysis.service.js";
import {
  determineRiskLevel,
  optimizeEfQuery,
  sortProblemsBySeverity,
} from "../../../../src/core/query-optimization/ef-query-optimizer.js";
import type { ProjectStack } from "../../../../src/core/project-stack/project-stack.types.js";

const sqlServerStack: ProjectStack = {
  projectPath: "/tmp",
  projects: [],
  targetFrameworks: ["net6.0"],
  primaryTargetFramework: "net6.0",
  csharpVersion: "10.0",
  efKind: "EFCore",
  efVersion: "6.0.28",
  provider: "SqlServer",
  providerFamily: "Relational",
  providerSupportLevel: "first_class",
  providerConfidence: "high",
  providerWarnings: [],
  detectedProviderPackages: [
    {
      name: "Microsoft.EntityFrameworkCore.SqlServer",
      version: "6.0.28",
      provider: "SqlServer",
      confidence: "high",
    },
  ],
  hasDapper: true,
  dapperVersion: "2.1.35",
  limitations: [],
  supportedOptimizations: [],
  warnings: [],
};

const sampleQuery = `
public async Task<List<CustomerDto>> GetCustomers()
{
    var customers = await _context.Customers
        .Include(x => x.Orders)
        .Where(x => x.Active)
        .ToListAsync();

    return customers.Select(x => new CustomerDto
    {
        Id = x.Id,
        Name = x.Name,
        TotalOrders = x.Orders.Count
    }).ToList();
}`;

describe("ef-query-optimizer", () => {
  it("should not emit optimizedEfCode in strict mode", () => {
    const analysis = analyzeQuery(sampleQuery, sqlServerStack);
    const result = optimizeEfQuery(sampleQuery, analysis, sqlServerStack, { mode: "strict" });

    expect(result.optimizedCode).toBeUndefined();
    expect(result.rewritePlan.length).toBeGreaterThan(0);
  });

  it("should add AsNoTracking rewrite plan for read-only query", () => {
    const code = `
return await _context.Products
    .Where(x => x.InStock)
    .ToListAsync();`;
    const analysis = analyzeQuery(code, sqlServerStack);
    const result = optimizeEfQuery(code, analysis, sqlServerStack, { mode: "strict" });

    expect(result.rewritePlan.some((p) => p.id === "add-as-no-tracking")).toBe(true);
  });

  it("should apply AsNoTracking in safe mode when high confidence", () => {
    const code = `
return await _context.Products
    .Where(x => x.InStock)
    .ToListAsync();`;
    const analysis = analyzeQuery(code, sqlServerStack);
    const result = optimizeEfQuery(code, analysis, sqlServerStack, {
      mode: "safe",
      rewriteCode: true,
    });

    expect(result.optimizedCode).toContain("AsNoTracking");
  });

  it("should replace Count() > 0 with Any() in safe mode", () => {
    const code = `
if (await _context.Orders.CountAsync() > 0)
{
    return true;
}`;
    const analysis = analyzeQuery(code, sqlServerStack);
    const result = optimizeEfQuery(code, analysis, sqlServerStack, {
      mode: "safe",
      rewriteCode: true,
    });

    expect(result.optimizedCode).toContain("AnyAsync()");
  });

  it("should mark manual review for custom method in Where", () => {
    const code = `
return await _context.Customers
    .Where(x => Normalizar(x.Nome) == nome)
    .ToListAsync();`;
    const analysis = analyzeQuery(code, sqlServerStack);
    const result = optimizeEfQuery(code, analysis, sqlServerStack, { mode: "strict" });

    expect(result.needsManualReview).toBe(true);
    expect(result.optimizedCode).toBeUndefined();
  });

  it("should compute high risk for early materialization", () => {
    const smells = analyzeQuery(sampleQuery).smells;
    expect(determineRiskLevel(smells)).toBe("high");
  });

  it("should sort problems by severity", () => {
    const smells = analyzeQuery(sampleQuery).smells;
    const sorted = sortProblemsBySeverity(smells);
    const order = sorted.map((s) => s.severity);
    const highIndex = order.indexOf("high");
    const mediumIndex = order.indexOf("medium");
    expect(highIndex).toBeGreaterThanOrEqual(0);
    if (mediumIndex >= 0) {
      expect(highIndex).toBeLessThan(mediumIndex);
    }
  });
});
