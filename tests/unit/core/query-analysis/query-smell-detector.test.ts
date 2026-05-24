import { describe, expect, it } from "vitest";
import { analyzeQuery } from "../../../../src/core/query-analysis/query-analysis.service.js";
import type { ProjectStack } from "../../../../src/core/project-stack/project-stack.types.js";

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

describe("query-smell-detector", () => {
  it("should detect EARLY_MATERIALIZATION for ToList before Select", () => {
    const analysis = analyzeQuery(toListBeforeSelectQuery);
    expect(analysis.smells.some((s) => s.type === "EARLY_MATERIALIZATION")).toBe(true);
    expect(analysis.smells.some((s) => s.type === "DTO_PROJECTION_AFTER_MATERIALIZATION")).toBe(true);
  });

  it("should detect EARLY_MATERIALIZATION for ToList before Where on variable", () => {
    const code = `
var dados = await _context.Clientes.ToListAsync();
return dados.Where(x => x.Ativo).Select(x => x.Nome).ToList();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "EARLY_MATERIALIZATION")).toBe(true);
  });

  it("should detect MISSING_AS_NO_TRACKING for read-only query", () => {
    const analysis = analyzeQuery(toListBeforeSelectQuery);
    expect(analysis.smells.some((s) => s.type === "MISSING_AS_NO_TRACKING")).toBe(true);
  });

  it("should not suggest MISSING_AS_NO_TRACKING when entity is mutated", () => {
    const code = `
var customer = await _context.Customers.FirstAsync();
customer.Name = "Updated";
await _context.SaveChangesAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "MISSING_AS_NO_TRACKING")).toBe(false);
  });

  it("should detect UNNECESSARY_INCLUDE_WITH_PROJECTION", () => {
    const code = `
return await _context.Pedidos
    .Include(x => x.Cliente)
    .Select(x => new PedidoDto { ClienteNome = x.Cliente.Nome })
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "UNNECESSARY_INCLUDE_WITH_PROJECTION")).toBe(true);
  });

  it("should detect MULTIPLE_COLLECTION_INCLUDES", () => {
    const code = `
return await _context.Pedidos
    .Include(x => x.Itens)
    .Include(x => x.Pagamentos)
    .Include(x => x.Anexos)
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "MULTIPLE_COLLECTION_INCLUDES")).toBe(true);
  });

  it("should mention AsSplitQuery only for EF Core 6+", () => {
    const code = `
return await _context.Pedidos
    .Include(x => x.Itens)
    .Include(x => x.Pagamentos)
    .ToListAsync();`;
    const ef6 = analyzeQuery(code, sqlServerStack);
    const ef2Stack = { ...sqlServerStack, efVersion: "2.1.0", primaryTargetFramework: "netcoreapp2.1" };
    const ef2 = analyzeQuery(code, ef2Stack);

    const ef6Smell = ef6.smells.find((s) => s.type === "MULTIPLE_COLLECTION_INCLUDES");
    const ef2Smell = ef2.smells.find((s) => s.type === "MULTIPLE_COLLECTION_INCLUDES");

    expect(ef6Smell?.suggestion).toContain("AsSplitQuery");
    expect(ef2Smell?.suggestion).toContain("not available");
  });

  it("should detect IN_MEMORY_PAGINATION", () => {
    const code = `
var dados = await query.ToListAsync();
return dados.Skip(skip).Take(take).ToList();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "IN_MEMORY_PAGINATION")).toBe(true);
  });

  it("should detect SKIP_TAKE_WITHOUT_ORDER_BY", () => {
    const code = `
var items = await _context.Orders
    .Where(x => x.Active)
    .Skip(10)
    .Take(20)
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "SKIP_TAKE_WITHOUT_ORDER_BY")).toBe(true);
  });

  it("should detect COUNT_GREATER_THAN_ZERO for > 0 and == 0", () => {
    const greater = `
if (await _context.Orders.CountAsync() > 0) { return true; }`;
    const equalsZero = `
if (await _context.Orders.CountAsync() == 0) { return true; }`;

    expect(analyzeQuery(greater).smells.some((s) => s.type === "COUNT_GREATER_THAN_ZERO")).toBe(true);
    expect(analyzeQuery(equalsZero).smells.some((s) => s.type === "COUNT_GREATER_THAN_ZERO")).toBe(true);
  });

  it("should not flag COUNT_GREATER_THAN_ZERO when count value is returned", () => {
    const code = `return await _context.Orders.CountAsync();`;
    expect(analyzeQuery(code).smells.some((s) => s.type === "COUNT_GREATER_THAN_ZERO")).toBe(false);
  });

  it("should detect LARGE_CONTAINS_RISK", () => {
    const code = `
var customerIds = request.CustomerIds;
var items = await _context.Orders
    .Where(x => customerIds.Contains(x.CustomerId))
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "LARGE_CONTAINS_RISK")).toBe(true);
  });

  it("should detect FUNCTION_ON_FILTERED_COLUMN", () => {
    const code = `
var items = await _context.Customers
    .Where(x => x.Name.ToLower() == name.ToLower())
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "FUNCTION_ON_FILTERED_COLUMN")).toBe(true);
  });

  it("should detect CUSTOM_METHOD_IN_WHERE", () => {
    const code = `
var items = await _context.Customers
    .Where(x => Normalizar(x.Nome) == nome)
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "CUSTOM_METHOD_IN_WHERE")).toBe(true);
  });

  it("should detect GROUP_BY_NAVIGATION_OR_OBJECT", () => {
    const code = `
return await _context.Pedidos
    .GroupBy(x => x.Cliente)
    .Select(g => g.Key)
    .ToListAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "GROUP_BY_NAVIGATION_OR_OBJECT")).toBe(true);
  });

  it("should detect FIRST_OR_DEFAULT_WITHOUT_ORDER", () => {
    const code = `
return await _context.Orders
    .Where(x => x.Active)
    .FirstOrDefaultAsync();`;
    const analysis = analyzeQuery(code);
    expect(analysis.smells.some((s) => s.type === "FIRST_OR_DEFAULT_WITHOUT_ORDER")).toBe(true);
  });

  it("should detect SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO", () => {
    const analysis = analyzeQuery(toListBeforeSelectQuery);
    expect(analysis.smells.some((s) => s.type === "SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO")).toBe(true);
  });

  it("should adapt relational smells for MongoDB provider guard", () => {
    const mongoStack: ProjectStack = {
      ...sqlServerStack,
      provider: "MongoDB",
      providerFamily: "Document",
      providerSupportLevel: "first_class",
      detectedProviderPackages: [
        {
          name: "MongoDB.EntityFrameworkCore",
          version: "8.0.0",
          provider: "MongoDB",
          confidence: "high",
        },
      ],
    };
    const code = `
return await _context.Pedidos
    .Include(x => x.Itens)
    .Include(x => x.Pagamentos)
    .ToListAsync();`;
    const analysis = analyzeQuery(code, mongoStack);
    expect(analysis.smells.some((s) => s.type === "MULTIPLE_COLLECTION_INCLUDES")).toBe(false);
    expect(analysis.analysisMode).toBe("generic_conservative");
  });
});
