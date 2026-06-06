# QueryForge MCP

Local-first MCP server for reviewing .NET EF Core, LINQ and Dapper query performance.

## What it does

QueryForge analyzes C# query snippets and returns conservative suggestions for common performance smells. It is designed for development and code review — not automatic refactoring.

### Tools

| Tool | Description |
| --- | --- |
| `inspect_project_stack` | Detect .NET runtime, EF/Dapper usage, and database providers from pasted `.csproj` content |
| `analyze_query` | Detect performance smells and return a summary with severity |
| `suggest_ef_rewrite` | Suggest a safer EF Core rewrite (no file changes) |
| `suggest_dapper_alternative` | Suggest a conservative Dapper alternative for read-only queries |
| `generate_review_report` | Generate a markdown review report with checklist |

## What it does not do

- Does **not** connect to databases
- Does **not** execute SQL
- Does **not** modify files automatically
- Does **not** replace execution plan analysis
- Does **not** guarantee performance improvements

Validate every suggestion with generated SQL, tests, and real data when possible.

## Install

```bash
git clone https://github.com/luismpenholato/queryforge-mcp.git
cd queryforge-mcp
npm install
npm test
npm run build
```

## Run locally

```bash
# Development (tsx, no build required)
npm run dev

# Production
npm run build
npm start
```

## Cursor configuration

Build first, then add to `.cursor/mcp.json` or Cursor MCP settings.

**Windows:**

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "node",
      "args": [
        "C:\\Users\\Luis Penholato\\Documents\\PROJETOS\\queryforge-mcp\\dist\\index.js"
      ]
    }
  }
}
```

**Linux/Mac:**

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "node",
      "args": [
        "/home/luis/projetos/queryforge-mcp/dist/index.js"
      ]
    }
  }
}
```

Replace the path with your absolute path to `dist/index.js`. Restart Cursor after changing MCP configuration.

## Example usage

Ask your MCP client:

> Analyze this EF Core query and suggest safe performance improvements.

Then paste your C# query. You can also try the sample in `examples/bad-ef-query.cs`, which triggers `TO_LIST_BEFORE_SELECT`, `UNNECESSARY_INCLUDE_WITH_PROJECTION`, and `MISSING_AS_NO_TRACKING`:

```csharp
public async Task<List<ProductSummaryDto>> GetProductsAsync()
{
    var products = await _context.Products
        .Include(x => x.Category)
        .Where(x => x.IsActive)
        .ToListAsync();

    return products
        .Select(x => new ProductSummaryDto
        {
            Id = x.Id,
            Name = x.Name,
            CategoryName = x.Category.Name
        })
        .ToList();
}
```

**Full report:**

> Use `generate_review_report` on this query with context "read-only API endpoint".

**Stack inspection:**

> Use `inspect_project_stack` with the pasted content of my `.csproj` file.

## Runtime and provider support

QueryForge does not execute SQL and does not connect to databases. Provider detection is based on pasted project metadata and package references.

**Supported by heuristic analysis:**

- .NET Framework 4.x
- .NET Core 2.x / 3.x
- .NET 5+
- .NET 6 / 7 / 8 / 9 / 10

**Query technologies:**

- LINQ
- Entity Framework Core
- Entity Framework 6 (partial)
- Dapper

**Database providers:**

- SQL Server
- MySQL
- MariaDB
- PostgreSQL
- SQLite
- Oracle
- Cosmos DB
- MongoDB
- In-Memory
- Unknown/custom providers

## Rules

Current heuristic rules (regex-based, conservative):

| Code | Severity | Description |
| --- | --- | --- |
| `TO_LIST_BEFORE_SELECT` | high | Materialization before projection |
| `MISSING_AS_NO_TRACKING` | medium | Read-only query without `AsNoTracking` |
| `COUNT_GREATER_THAN_ZERO` | medium | Using `Count` instead of `Any` for existence check |
| `PAGINATION_WITHOUT_ORDER_BY` | high | `Skip`/`Take` without `OrderBy` |
| `UNNECESSARY_INCLUDE_WITH_PROJECTION` | medium | `Include` with `Select` projection |
| `FIRST_WITHOUT_ORDER_BY` | low | `First` without explicit ordering |

## Architecture

```text
src/
├── domain/       # Types and contracts
├── application/  # Services (analysis, rewrite, report)
├── rules/        # Isolated, testable query rules
├── tools/        # MCP tool registrations
└── formatters/   # Output formatters
```

## Examples in tests and docs

Use fictional English domain names only (`Product`, `Category`, `Order`, `Customer`, `Invoice`, `BlogPost`, `Author`, `Book`, `Review`, `Store`). Avoid company-specific or Portuguese domain names in examples.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests run CI (`npm test` and `npm run build`).

## Roadmap

- **v0.3.0** — `.cs` file scanner, diff generation, optional `apply_patch` with confirmation

## License

MIT — see [LICENSE](LICENSE).
