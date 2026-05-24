# QueryForge MCP

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Status](https://img.shields.io/badge/status-local--first%20MVP-green.svg)
![MCP](https://img.shields.io/badge/MCP-stdio-purple.svg)

QueryForge MCP is a local Model Context Protocol server for analyzing existing Entity Framework, EF Core, LINQ and Dapper queries in .NET projects. It detects query performance smells and provides conservative rewrite plans without executing SQL, connecting to databases or modifying files.

> **Status:** v0.1.0 local-first MVP — GitHub repository only. Clone, build, and run locally in Cursor.

## Why QueryForge exists

Poor EF queries are common in .NET projects: early materialization, unnecessary `Include`, missing `AsNoTracking`, and DTO projection after `ToListAsync()` often slip into production code.

QueryForge helps developers **review** query performance during development and code review. The focus is **behavior preservation** — suggestions are conservative, and equivalence is not assumed unless confidence is high.

QueryForge is **not** an automatic refactor tool. It returns smells, a step-by-step `rewritePlan`, and behavior risk signals. You apply changes manually and validate with tests, generated SQL, and execution plans.

**Strict mode is the recommended default.** It returns analysis and a rewrite plan without consolidated auto-rewritten code.

## What it does

- `inspect_project_stack` — detect .NET stack, EF version, provider, Dapper, and supported optimizations
- `optimize_existing_query` — analyze EF/LINQ queries with strict/safe modes, rewrite plan, and behavior risk
- `suggest_dapper_alternative` — parameterized Dapper alternative for read-only relational scenarios
- `compare_ef_vs_dapper` — compare EF vs Dapper with scoring and recommendation
- `suggest_indexes` — suggest possible indexes (always validate with execution plan)

## What it does not do

- Does **not** execute SQL
- Does **not** connect to databases
- Does **not** modify project files
- Does **not** run shell commands
- Does **not** replace profiling or execution plan review
- Does **not** guarantee performance gains without real validation

See [SECURITY.md](SECURITY.md) for the security model.

## Quick start

```bash
git clone https://github.com/luismpenholato/queryforge-mcp.git
cd queryforge-mcp
npm install
npm run typecheck
npm test
npm run build
```

The `dist/` folder is generated locally and is **not** committed to GitHub. Run `npm run build` after cloning or pulling changes.

Repository: [github.com/luismpenholato/queryforge-mcp](https://github.com/luismpenholato/queryforge-mcp)

## Cursor local configuration

Build first, then add this to your Cursor MCP settings (recommended):

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "node",
      "args": [
        "C:/Users/Luis Penholato/Documents/PROJETOS/queryforge-mcp/dist/index.js"
      ]
    }
  }
}
```

- Replace the path with your **absolute** path to the cloned repository if different
- Run `npm run build` before starting Cursor
- Restart Cursor after changing MCP configuration

### Alternative: npm link (local only)

From the repository root:

```bash
npm link
```

Then configure:

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "queryforge-mcp"
    }
  }
}
```

## Recommended production usage

Use `optimize_existing_query` in **strict** mode by default:

```json
{
  "projectPath": "C:/dev/meu-projeto-dotnet",
  "code": "cole aqui o método/query EF",
  "mode": "strict",
  "preserveBehavior": true
}
```

- **strict** does not return `optimizedEfCode`
- **strict** returns `problems`, `rewritePlan`, and `behaviorPreservation`
- **safe** should be used only for simple, high-confidence cases
- Apply changes manually
- Validate tests, generated SQL, and execution plans

Full guidelines: [docs/production-usage.md](docs/production-usage.md)

## Example: optimize_existing_query

**Before:**

```csharp
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
}
```

**MCP call:**

```json
{
  "projectPath": "C:/dev/sample-app",
  "code": "public async Task<List<CustomerDto>> GetCustomers() { ... }",
  "mode": "strict",
  "preserveBehavior": true
}
```

**Example output (summary):**

- `EARLY_MATERIALIZATION`
- `DTO_PROJECTION_AFTER_MATERIALIZATION`
- `UNNECESSARY_INCLUDE_WITH_PROJECTION`
- `behaviorPreservation.behaviorRisk`: medium/high
- `rewritePlan` suggesting projection before `ToListAsync`
- `needsManualReview` for `Include` removal

**After (manual suggestion — validate before applying):**

```csharp
public async Task<List<CustomerDto>> GetCustomers()
{
    return await _context.Customers
        .AsNoTracking()
        .Where(x => x.Active)
        .Select(x => new CustomerDto
        {
            Id = x.Id,
            Name = x.Name,
            TotalOrders = x.Orders.Count()
        })
        .ToListAsync();
}
```

> This code is a review suggestion. Do not apply it without tests, SQL comparison, and execution plan validation.

More examples: [docs/examples.md](docs/examples.md)

## Tools

| Tool | Purpose | Safe behavior |
|------|---------|---------------|
| `inspect_project_stack` | Detect .NET/EF/provider/Dapper stack | Read-only file access under `projectPath` |
| `optimize_existing_query` | Detect smells and suggest conservative EF rewrites | No file writes; strict mode by default |
| `suggest_dapper_alternative` | Parameterized Dapper for read-only queries | Blocked for Document/InMemory/Unknown providers |
| `compare_ef_vs_dapper` | Score EF vs Dapper trade-offs | Recommendations require manual review |
| `suggest_indexes` | Suggest possible indexes | Conceptual only; validate with execution plan |

## Query smells detected

Main smells in v0.1:

- `EARLY_MATERIALIZATION`
- `DTO_PROJECTION_AFTER_MATERIALIZATION`
- `MISSING_AS_NO_TRACKING`
- `UNNECESSARY_INCLUDE_WITH_PROJECTION`
- `MULTIPLE_COLLECTION_INCLUDES`
- `IN_MEMORY_PAGINATION`
- `SKIP_TAKE_WITHOUT_ORDER_BY`
- `COUNT_GREATER_THAN_ZERO`
- `LARGE_CONTAINS_RISK`
- `FUNCTION_ON_FILTERED_COLUMN`
- `CUSTOM_METHOD_IN_WHERE`
- `GROUP_BY_NAVIGATION_OR_OBJECT`
- `FIRST_OR_DEFAULT_WITHOUT_ORDER`
- `SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO`
- `CLIENT_EVALUATION_RISK`

Full catalog: [docs/query-smells.md](docs/query-smells.md)

## Provider support

| Family | Providers | Notes |
|--------|-----------|-------|
| **Relational** | SQL Server, PostgreSQL, MySQL, MariaDB, Oracle, SQLite, and others | Full relational heuristics, Dapper and index suggestions when appropriate |
| **Document** | MongoDB, Cosmos DB | Generic analysis; no SQL/Dapper/index SQL |
| **InMemory** | EF InMemory provider | Generic analysis + non-representative performance warning |
| **Custom / Unknown** | Unrecognized or missing EF providers | Generic conservative analysis only |

Details: [docs/adding-providers.md](docs/adding-providers.md)

## Project structure

```
src/
  index.ts              # CLI entry (stdio MCP)
  mcp/                  # Protocol, schemas, thin tools
  core/                 # Business logic
  shared/               # fs, security, text
tests/
  unit/
  integration/
  fixtures/dotnet-projects/
docs/
```

## Development commands

```bash
npm run typecheck
npm test
npm run build
npm run dev      # stdio MCP server
```

## Roadmap

| Version | Focus |
|---------|-------|
| **v0.1** | Local-first MVP (current) — GitHub + Cursor local setup |
| **v0.2** | More real-world queries and better Dapper/index suggestions |
| **v0.3** | Optional C# parser |
| **v1.0** | Stable API |

**Later (not in v0.1):** npm publishing and MCP Registry publishing.

Details: [docs/roadmap.md](docs/roadmap.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
