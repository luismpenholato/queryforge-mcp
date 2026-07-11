# QueryForge MCP

[![CI](https://github.com/luismpenholato/queryforge-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luismpenholato/queryforge-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/luismpenholato/queryforge-mcp/actions/workflows/publish.yml/badge.svg)](https://github.com/luismpenholato/queryforge-mcp/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/@luispenholato/queryforge-mcp)](https://www.npmjs.com/package/@luispenholato/queryforge-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@luispenholato/queryforge-mcp)](https://www.npmjs.com/package/@luispenholato/queryforge-mcp)
[![GitHub release](https://img.shields.io/github/v/release/luismpenholato/queryforge-mcp?label=release)](https://github.com/luismpenholato/queryforge-mcp/releases)
[![License: MIT](https://img.shields.io/github/license/luismpenholato/queryforge-mcp)](LICENSE)
[![Node.js](https://img.shields.io/node/v/@luispenholato/queryforge-mcp)](https://nodejs.org/)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/luismpenholato?label=Sponsor&logo=github)](https://github.com/sponsors/luismpenholato)

QueryForge is a local-first MCP server and programmatic TypeScript library for reviewing .NET LINQ, Entity Framework and Dapper query performance.

It analyzes C# query snippets and returns conservative suggestions for common performance smells. It is designed for development and code review — not automatic refactoring.

The public API is designed for editor, CLI and CI integrations.

## What it does not do

- Does **not** connect to databases
- Does **not** execute SQL
- Does **not** modify files automatically
- Does **not** replace execution plan analysis
- Does **not** guarantee performance improvements

Validate every suggestion with generated SQL, tests, and real data when possible.

## Install as MCP

```bash
npx -y @luispenholato/queryforge-mcp
```

Pinned version:

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "npx",
      "args": [
        "-y",
        "@luispenholato/queryforge-mcp@0.7.0"
      ]
    }
  }
}
```

## Install as library

```bash
npm install @luispenholato/queryforge-mcp
```

## Programmatic API

```ts
import {
  QueryAnalysisService,
  type QueryAnalysisRequest
} from '@luispenholato/queryforge-mcp';

const service = new QueryAnalysisService();

const request: QueryAnalysisRequest = {
  code: `
    var exists = await context.Products
      .Where(product => product.IsActive)
      .CountAsync() > 0;
  `,
  provider: 'ef-core',
  filePath: 'Features/Products/ProductService.cs',
  languageId: 'csharp'
};

const result = service.analyze(request);

for (const smell of result.smells) {
  console.log({
    code: smell.code,
    severity: smell.severity,
    range: smell.range,
    fingerprint: smell.fingerprint,
    fixes: smell.fixes
  });
}
```

### Source ranges

- `range.start` is inclusive and `range.end` is exclusive.
- Offsets are calculated against the original `request.code` string.
- Ranges are optional when a smell cannot be located safely.
- Line and column should be calculated by the consumer (`document.positionAt(range.start)`).

### Query fixes

- Only fixes with `safety: "safe"` are eligible for automatic application.
- Fixes with `safety: "review-required"` need human validation.
- QueryForge does not modify files; the consumer decides whether to apply edits.
- Apply multiple edits from the highest offset to the lowest.

### Privacy

QueryForge analyzes the code supplied by the local consumer. It does not connect to a database, upload source code or execute SQL as part of analysis.

## MCP tools

| Tool | Description |
| --- | --- |
| `inspect_project_stack` | Detect .NET runtime, EF/Dapper usage, and database providers from pasted `.csproj` content |
| `analyze_query` | Detect performance smells and return a summary with severity |
| `analyze_query_batch` | Analyze multiple C# files/snippets and rank the riskiest ones |
| `suggest_ef_rewrite` | Conservative EF Core rewrite advisor (safe auto-fixes + structured plan, no file changes) |
| `suggest_dapper_alternative` | Suggest a conservative Dapper alternative for read-only queries |
| `suggest_index_candidates` | Suggest conservative index candidates from query filters and ordering (not definitive indexes) |
| `generate_review_report` | Generate a markdown review report with checklist |

## Cursor MCP config

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "npx",
      "args": [
        "-y",
        "@luispenholato/queryforge-mcp"
      ]
    }
  }
}
```

Pinned version:

```json
{
  "mcpServers": {
    "queryforge": {
      "command": "npx",
      "args": [
        "-y",
        "@luispenholato/queryforge-mcp@0.7.0"
      ]
    }
  }
}
```

## Install from source

```bash
git clone https://github.com/luismpenholato/queryforge-mcp.git
cd queryforge-mcp
npm ci
npm run validate
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
        "/home/admin/projects/queryforge-mcp/dist/index.js"
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

**EF rewrite advisor:**

> Use `suggest_ef_rewrite` on the same query.

`suggest_ef_rewrite` is conservative by design:

- **Safe fixes** — may auto-apply `AsNoTracking()` for read-only queries and `Count` → `Any`/`AnyAsync` for existence checks.
- **Partial rewrite** — when safe fixes apply alongside non-sargable smells, the code is updated only where safe and a manual review list is included.
- **No automatic rewrite** — for smells like `FUNCTION_ON_COLUMN_FILTER`, `TO_STRING_IN_QUERY_FILTER`, or `CONTAINS_ON_CONVERTED_VALUE`, QueryForge returns a structured plan and conceptual examples (e.g. DateTime range filters) instead of rewriting risky predicates.

QueryForge does not invent business rules or guarantee exact generated SQL shape.

**Full report:**

> Use `generate_review_report` on this query with context "read-only API endpoint".

**Stack inspection:**

> Use `inspect_project_stack` with the pasted content of my `.csproj` file.

## Batch analysis

`analyze_query_batch` lets you analyze multiple C# files or snippets at once and rank the riskiest ones for review.

QueryForge does **not** read files from disk. The MCP client must provide the file path and content.

Example input:

```json
{
  "files": [
    {
      "path": "Features/Orders/GetOrdersHandler.cs",
      "content": "return await _context.Orders.Where(o => o.OrderedAt.Year == currentYear).ToListAsync();"
    },
    {
      "path": "Features/Products/GetProductsHandler.cs",
      "content": "return await _context.Products.AsNoTracking().Take(100).ToListAsync();"
    }
  ],
  "provider": "ef-core"
}
```

Example output:

```text
# QueryForge Batch Analysis

Files analyzed: 2
Files with issues: 1
Highest severity: high

## Top risky files

### 1. Features/Orders/GetOrdersHandler.cs
- Severity: high
- Score: 11
- High impact smells: FUNCTION_ON_COLUMN_FILTER
```

Use batch analysis to prioritize which handlers, repositories or query snippets should be reviewed first. Files are scored by severity and high-impact smell bonuses (non-sargable filters, premature materialization, large ordered result sets).

## Index candidate suggestions

`suggest_index_candidates` analyzes `Where`, `OrderBy` and `ThenBy` patterns to propose **index candidates for manual review** — not definitive indexes.

QueryForge:

- Does **not** inspect the real database schema
- Does **not** check existing indexes
- Does **not** validate execution plans
- May emit warnings when query smells (function-on-column, `ToString`, cartesian product, N+1) prevent effective index usage

Example input:

```json
{
  "code": "return await _context.Orders.Where(o => o.CustomerId == customerId && o.OrderedAt >= startDate).OrderByDescending(o => o.OrderedAt).ToListAsync();",
  "databaseProvider": "sql-server",
  "tableName": "Orders"
}
```

Example output (candidate, not recommendation):

```sql
CREATE INDEX IX_Orders_CustomerId_OrderedAt
ON Orders (CustomerId, OrderedAt DESC);
```

Every response includes **Manual review required** and a validation checklist (existing indexes, execution plan, selectivity, read/write trade-offs).

Try `examples/index-candidate-query.cs` for a sargable query that generates a composite candidate.

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
| `DUPLICATED_PREDICATE` | low | Repeated condition inside the same `Where` |

### Structural query smells

Structural smells target query shape problems common in handlers, repositories and application services.

| Code | Severity | Description |
| --- | --- | --- |
| `N_PLUS_ONE_QUERY_IN_LOOP` | high | EF/LINQ query executed inside `foreach`/`for`/`while` |
| `MULTIPLE_ROUND_TRIPS_IN_LOOP` | high | Two or more queries inside the same loop body |
| `CARTESIAN_PRODUCT_QUERY` | high | Multiple `from` clauses or chained `SelectMany` without explicit join |
| `CORRELATED_SUBQUERY_IN_PROJECTION` | medium | `Count`/`Sum`/`Any`/`Average` correlated inside `Select` |
| `IMPLICIT_CONVERSION_IN_FILTER` | high | `ToString`/`Parse`/`Convert` inside `Where` |
| `FULL_ENTITY_MATERIALIZATION` | medium | `ToList`/`ToListAsync` without prior `Select` projection |

`analyze_query_batch` uses these rules (with combo bonuses) to prioritize the riskiest files first — N+1 patterns, cartesian products and implicit conversions score higher than tracking-only issues.

Each smell may include `category`, `whyItMatters`, `rewritePlan`, and `safeAutoFix` in the analysis output.

## Example contracts

The `examples/` folder defines canonical query samples. Each file has a matching test in `tests/examples/` that asserts the expected smell codes — this is the product contract for regression safety.

| Example | Scenario | Expected smells |
| --- | --- | --- |
| `bad-ef-query.cs` | Include + early `ToList` before projection | `TO_LIST_BEFORE_SELECT`, `UNNECESSARY_INCLUDE_WITH_PROJECTION`, `MISSING_AS_NO_TRACKING` |
| `advanced-linq-query.cs` | Mixed sargability, pagination and tracking issues (multiple `Where` calls) | `FUNCTION_ON_COLUMN_FILTER`, `TO_STRING_IN_QUERY_FILTER`, `CONTAINS_ON_CONVERTED_VALUE`, `STRING_TRANSFORM_ON_COLUMN_FILTER`, `CONTAINS_ON_STRING_COLUMN`, `REDUNDANT_MONTH_RANGE_FILTER`, `LARGE_TAKE`, `LARGE_TAKE_WITH_ORDER_BY`, `MISSING_AS_NO_TRACKING` |
| `function-on-column-query.cs` | Single multiline `Where` with `.Year`, `.Month` and `ToString().Contains` | `FUNCTION_ON_COLUMN_FILTER`, `TO_STRING_IN_QUERY_FILTER`, `CONTAINS_ON_CONVERTED_VALUE`, `REDUNDANT_MONTH_RANGE_FILTER`, `LARGE_TAKE`, `LARGE_TAKE_WITH_ORDER_BY`, `MISSING_AS_NO_TRACKING` |
| `materialization-before-filter.cs` | Full table load then filter/sort/page in memory | `TO_LIST_BEFORE_WHERE`, `TO_LIST_BEFORE_ORDER_BY`, `TO_LIST_BEFORE_SKIP_TAKE`, `TO_LIST_BEFORE_SELECT` |
| `pagination-heavy-query.cs` | Unstable ordering and large export batch | `MULTIPLE_ORDER_BY`, `LARGE_TAKE`, `LARGE_TAKE_WITH_ORDER_BY` |
| `multiple-includes-query.cs` | Cartesian-prone includes with DTO projection | `MULTIPLE_COLLECTION_INCLUDES`, `UNNECESSARY_INCLUDE_WITH_PROJECTION`, `MISSING_AS_NO_TRACKING` |
| `client-side-method-query.cs` | Custom helpers inside `Where` predicates | `CLIENT_SIDE_METHOD_IN_WHERE` |
| `string-search-query.cs` | Non-sargable text search patterns | `STRING_TRANSFORM_ON_COLUMN_FILTER`, `CONTAINS_ON_STRING_COLUMN`, `TO_STRING_IN_QUERY_FILTER`, `CONTAINS_ON_CONVERTED_VALUE` |
| `structural-query-smells.cs` | N+1, cartesian product, correlated subquery, implicit conversion | `N_PLUS_ONE_QUERY_IN_LOOP`, `MULTIPLE_ROUND_TRIPS_IN_LOOP`, `CARTESIAN_PRODUCT_QUERY`, `CORRELATED_SUBQUERY_IN_PROJECTION`, `IMPLICIT_CONVERSION_IN_FILTER`, `DUPLICATED_PREDICATE`, `FULL_ENTITY_MATERIALIZATION` |
| `index-candidate-query.cs` | Sargable filters + ordering for index candidate generation | Composite candidate with `CustomerId`, `Status`, `OrderedAt`, `Id` |

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

## Community

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Report a bug](https://github.com/luismpenholato/queryforge-mcp/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/luismpenholato/queryforge-mcp/issues/new?template=feature_request.yml)
- [Support the project](https://github.com/sponsors/luismpenholato)

Pull requests run CI (`npm run validate`).

## Support the project

QueryForge is free, open source and local-first.

If it helps you review LINQ, Entity Framework or Dapper queries, you can support its continued development through [GitHub Sponsors](https://github.com/sponsors/luismpenholato).

## Release process

1. Update `package.json`, `package-lock.json` and `src/server.ts` to the new stable version, for example `0.8.0`.
2. Add the matching section to `CHANGELOG.md` and the release link at the bottom.
3. Run `npm run validate`.
4. Commit the release changes and merge into `main`.
5. GitHub Actions on `main` will automatically:
   - read `package.json.version`;
   - validate `package-lock.json`, `CHANGELOG.md` and `src/server.ts`;
   - run tests, build and public API validation;
   - pack and validate the exact npm tarball;
   - create the annotated tag `vX.Y.Z` only after those checks pass;
   - publish and attach the same validated tarball;
   - create the GitHub Release from the matching changelog section.

If the tag for the current version already exists, the workflow finishes as a no-op.

Example:

```text
version: 0.8.0
merge into main
→ validate metadata
→ test, build, validate API, pack and validate tarball
→ tag v0.8.0
→ npm @luispenholato/queryforge-mcp@0.8.0
→ GitHub Release QueryForge MCP v0.8.0
```

Useful local helpers:

```bash
npm run release:validate -- v0.8.0
npm run release:notes -- v0.8.0
```

## Roadmap

- **v0.8.0** — Dapper safety rules, expanded aggregation smells
- **Future** — VS Code/Cursor extension, optional Roslyn-based analysis, guarded `apply_patch`

## License

MIT — see [LICENSE](LICENSE).
