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
        "C:\\Users\\admin\\Documents\\projects\\queryforge-mcp\\dist\\index.js"
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

QueryForge uses conservative, regex-based heuristics. It detects **possible** issues in generated SQL patterns (non-sargable filters, early materialization, unstable pagination) — it does **not** replace execution plan analysis, index tuning, or runtime profiling.

### Core rules

| Code | Severity | Description |
| --- | --- | --- |
| `TO_LIST_BEFORE_SELECT` | high | Materialization before projection |
| `MISSING_AS_NO_TRACKING` | medium | Read-only query without `AsNoTracking` |
| `COUNT_GREATER_THAN_ZERO` | medium | Using `Count` instead of `Any` for existence check |
| `PAGINATION_WITHOUT_ORDER_BY` | high | `Skip`/`Take` without `OrderBy` |
| `UNNECESSARY_INCLUDE_WITH_PROJECTION` | medium | `Include` with `Select` projection |
| `FIRST_WITHOUT_ORDER_BY` | low | `First` without explicit ordering |

### Advanced LINQ/EF performance rules

#### Sargability / index usage

| Code | Severity | Description |
| --- | --- | --- |
| `FUNCTION_ON_COLUMN_FILTER` | high | DateTime members (`.Year`, `.Month`, `.Day`, etc.) inside `Where` |
| `TO_STRING_IN_QUERY_FILTER` | high | `ToString()` inside `Where` |
| `STRING_TRANSFORM_ON_COLUMN_FILTER` | high | `ToLower`/`ToUpper`/`Trim`/`Substring` on column inside `Where` |
| `CONTAINS_ON_CONVERTED_VALUE` | high | `ToString().Contains(...)` inside `Where` |
| `CONTAINS_ON_STRING_COLUMN` | medium | `Contains` on string column (may become `LIKE '%term%'`) |

#### Materialization / client-side evaluation

| Code | Severity | Description |
| --- | --- | --- |
| `TO_LIST_BEFORE_WHERE` | high | `ToList`/`ToListAsync` before `Where` |
| `TO_LIST_BEFORE_ORDER_BY` | high | `ToList`/`ToListAsync` before `OrderBy` |
| `TO_LIST_BEFORE_SKIP_TAKE` | high | `ToList`/`ToListAsync` before `Skip`/`Take` |
| `AS_ENUMERABLE_BEFORE_QUERY_OPERATORS` | high | `AsEnumerable` before query operators |
| `CLIENT_SIDE_METHOD_IN_WHERE` | medium | Custom method call inside `Where` |

#### Pagination / ordering / volume

| Code | Severity | Description |
| --- | --- | --- |
| `LARGE_TAKE` | medium | `Take` >= 10000 |
| `LARGE_TAKE_WITH_ORDER_BY` | medium | Large `Take` combined with `OrderBy` |
| `MULTIPLE_ORDER_BY` | medium | Multiple `OrderBy` calls (second overrides first) |

#### Projection / includes

| Code | Severity | Description |
| --- | --- | --- |
| `MULTIPLE_COLLECTION_INCLUDES` | medium | Two or more `Include`/`ThenInclude` calls |

#### Redundant filters

| Code | Severity | Description |
| --- | --- | --- |
| `REDUNDANT_MONTH_RANGE_FILTER` | low | `new[] {1..12}.Contains(x.Date.Month)` |

Each smell may include `category`, `whyItMatters`, `rewritePlan`, and `safeAutoFix` in the analysis output.

## Example contracts

The `examples/` folder defines canonical query samples. Each file has a matching test in `tests/examples/` that asserts the expected smell codes — this is the product contract for regression safety.

| Example | Scenario | Expected smells |
| --- | --- | --- |
| `bad-ef-query.cs` | Include + early `ToList` before projection | `TO_LIST_BEFORE_SELECT`, `UNNECESSARY_INCLUDE_WITH_PROJECTION`, `MISSING_AS_NO_TRACKING` |
| `advanced-linq-query.cs` | Mixed sargability, pagination and tracking issues | `FUNCTION_ON_COLUMN_FILTER`, `TO_STRING_IN_QUERY_FILTER`, `CONTAINS_ON_CONVERTED_VALUE`, `STRING_TRANSFORM_ON_COLUMN_FILTER`, `CONTAINS_ON_STRING_COLUMN`, `REDUNDANT_MONTH_RANGE_FILTER`, `LARGE_TAKE`, `LARGE_TAKE_WITH_ORDER_BY`, `MISSING_AS_NO_TRACKING` |
| `materialization-before-filter.cs` | Full table load then filter/sort/page in memory | `TO_LIST_BEFORE_WHERE`, `TO_LIST_BEFORE_ORDER_BY`, `TO_LIST_BEFORE_SKIP_TAKE`, `TO_LIST_BEFORE_SELECT` |
| `pagination-heavy-query.cs` | Unstable ordering and large export batch | `MULTIPLE_ORDER_BY`, `LARGE_TAKE`, `LARGE_TAKE_WITH_ORDER_BY` |
| `multiple-includes-query.cs` | Cartesian-prone includes with DTO projection | `MULTIPLE_COLLECTION_INCLUDES`, `UNNECESSARY_INCLUDE_WITH_PROJECTION`, `MISSING_AS_NO_TRACKING` |
| `client-side-method-query.cs` | Custom helpers inside `Where` predicates | `CLIENT_SIDE_METHOD_IN_WHERE` |
| `string-search-query.cs` | Non-sargable text search patterns | `STRING_TRANSFORM_ON_COLUMN_FILTER`, `CONTAINS_ON_STRING_COLUMN`, `TO_STRING_IN_QUERY_FILTER`, `CONTAINS_ON_CONVERTED_VALUE` |

Run `npm test` to validate all contracts. Use these samples when evaluating QueryForge output in Cursor or other MCP clients.

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

Use fictional English domain names only (`Product`, `Category`, `Order`, `Customer`, `Invoice`, `Review`, `Store`). Avoid company-specific or Portuguese domain names in examples.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests run CI (`npm test` and `npm run build`).

## Roadmap

- **v0.4.0** — Additional example contracts, Dapper safety rules, expanded aggregation smells
- **Future** — Optional Roslyn-based analysis, project scanner, guarded `apply_patch`

## License

MIT — see [LICENSE](LICENSE).
