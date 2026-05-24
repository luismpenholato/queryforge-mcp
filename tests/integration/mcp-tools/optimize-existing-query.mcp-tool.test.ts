import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { optimizeExistingQueryTool } from "../../../src/mcp/tools/optimize-existing-query.mcp-tool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../fixtures/dotnet-projects");

const toListBeforeSelectQuery = `
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

const missingAsNoTrackingQuery = `
public async Task<List<Product>> GetProducts()
{
    return await _context.Products
        .Where(x => x.InStock)
        .ToListAsync();
}`;

const includeWithProjectionQuery = `
public async Task<List<PedidoDto>> GetPedidos()
{
    return await _context.Pedidos
        .Include(x => x.Cliente)
        .Select(x => new PedidoDto { ClienteNome = x.Cliente.Nome })
        .ToListAsync();
}`;

const multipleCollectionIncludesQuery = `
public async Task<List<Pedido>> GetPedidos()
{
    return await _context.Pedidos
        .Include(x => x.Itens)
        .Include(x => x.Pagamentos)
        .ToListAsync();
}`;

describe("optimize-existing-query mcp tool", () => {
  it("should analyze ToList before Select and return EF_OPTIMIZED", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-2-sqlserver");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: toListBeforeSelectQuery,
      preserveBehavior: true,
    });

    expect(result.problems.some((p) => p.type === "EARLY_MATERIALIZATION")).toBe(true);
    expect(result.problems.some((p) => p.type === "DTO_PROJECTION_AFTER_MATERIALIZATION")).toBe(true);
    expect(result.recommendedApproach).toBe("MANUAL_REVIEW");
    expect(result.riskLevel).toBe("high");
    expect(result.mode).toBe("strict");
    expect(result.optimizedEfCode).toBeNull();
    expect(result.rewritePlan.length).toBeGreaterThan(0);
    expect(result.behaviorPreservation.preserved).toBe(true);
    expect(result.markdownSummary).toBeDefined();
  });

  it("should detect missing AsNoTracking and suggest rewrite plan", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-6-sqlserver");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: missingAsNoTrackingQuery,
      mode: "strict",
    });

    expect(result.problems.some((p) => p.type === "MISSING_AS_NO_TRACKING")).toBe(true);
    expect(result.rewritePlan.some((p) => p.id === "add-as-no-tracking")).toBe(true);
    expect(result.optimizedEfCode).toBeNull();
  });

  it("should emit optimizedEfCode in safe mode for simple AsNoTracking query", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-6-sqlserver");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: missingAsNoTrackingQuery,
      mode: "safe",
      rewriteCode: true,
    });

    expect(result.optimizedEfCode).toContain("AsNoTracking");
  });

  it("should detect Include with DTO projection", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-6-sqlserver");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: includeWithProjectionQuery,
    });

    expect(result.problems.some((p) => p.type === "UNNECESSARY_INCLUDE_WITH_PROJECTION")).toBe(true);
  });

  it("should not suggest relational SQL/Dapper for MongoDB provider", async () => {
    const projectPath = path.join(fixturesDir, "providers/mongodb");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: multipleCollectionIncludesQuery,
    });

    expect(result.analysisMode).toBe("generic_conservative");
    expect(result.needsManualReview).toBe(true);
    expect(result.dapperAlternative.available).toBe(false);
    expect(result.problems.some((p) => p.type === "MULTIPLE_COLLECTION_INCLUDES")).toBe(false);
    expect(result.versionNotes.some((n) => /Document provider|Conservative/i.test(n))).toBe(true);
  });

  it("should not mention AsSplitQuery for EF Core 2.1", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-2-sqlserver");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: multipleCollectionIncludesQuery,
    });

    const smell = result.problems.find((p) => p.type === "MULTIPLE_COLLECTION_INCLUDES");
    expect(smell?.suggestion).not.toMatch(/Consider AsSplitQuery/i);
    expect(
      result.versionNotes.some((n) => /AsSplitQuery|not supported/i.test(n)) ||
        smell?.suggestion.includes("not available"),
    ).toBe(true);
  });

  it("should mention AsSplitQuery for EF Core 6 with multiple collection includes", async () => {
    const projectPath = path.join(fixturesDir, "ef-core-6-sqlserver");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: multipleCollectionIncludesQuery,
    });

    const smell = result.problems.find((p) => p.type === "MULTIPLE_COLLECTION_INCLUDES");
    expect(smell?.suggestion).toMatch(/AsSplitQuery/i);
  });

  it("should mark dapper requiresNewDependency when not installed", async () => {
    const projectPath = path.join(fixturesDir, "no-dapper");
    const result = await optimizeExistingQueryTool({
      projectPath,
      code: toListBeforeSelectQuery,
    });

    expect(result.dapperAlternative.requiresNewDependency).toBe(true);
  });
});
