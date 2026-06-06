# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] - 2026-06-06

### Fixed

- Index candidate extraction no longer treats derived members (`Year`, `Month`, `ToString`, `ToLower`, etc.) as real table columns
- Function-on-column queries now produce conditional candidates on base columns (e.g. `DataPedido DESC`) instead of invalid indexes like `IX_Pedidos_Year_DataPedido`
- Non-sargable filter columns (e.g. `ToString().Contains`) are excluded from automatic composite index keys; they appear only in post-rewrite evaluation notes

### Added

- `requiresQueryRewrite` and `rewriteRequiredReason` fields on `IndexCandidate`
- `postRewriteEvaluation` field on `IndexCandidateResult` with explicit SQL guidance for deferred composite keys
- Safer warnings and formatter output for rewrite-dependent index candidates
- Tests for derived-member exclusion, conditional candidates, and combined function-on-column + `ToString` filters

### Changed

- Summary text distinguishes conditional candidates requiring query rewrite from direct candidates
- Summary and formatter messaging tier candidates: primary index after date/range rewrite, optional composite only after per-column filter rewrite
- Global warnings reinforce that creating indexes before rewrite is usually maintenance cost without gain, and that `INCLUDE` covering indexes remain a manual advanced decision

## [0.6.0] - 2026-06-06

### Added

- `suggest_index_candidates` MCP tool for conservative index candidate analysis
- `IndexCandidateService` extracting equality, range and ordering columns from LINQ/EF queries
- Provider-specific SQL formatting for relational databases (SQL Server, PostgreSQL, MySQL, MariaDB, SQLite, Oracle)
- Warnings when query smells may prevent effective index usage
- `examples/index-candidate-query.cs` contract sample with integration test
- Tests for index candidate service and markdown formatter

### Notes

- QueryForge does not inspect real database schema, existing indexes or execution plans
- Every suggestion is an index **candidate** requiring manual review
- Cosmos DB, MongoDB and In-Memory providers do not receive relational SQL output

## [0.5.0] - 2026-06-06

### Added

- Structural query smell detection with seven new rules
- `N_PLUS_ONE_QUERY_IN_LOOP` — query execution inside foreach/for/while
- `MULTIPLE_ROUND_TRIPS_IN_LOOP` — multiple queries in the same loop body
- `CARTESIAN_PRODUCT_QUERY` — multiple `from` clauses or chained `SelectMany`
- `CORRELATED_SUBQUERY_IN_PROJECTION` — correlated aggregates inside `Select`
- `IMPLICIT_CONVERSION_IN_FILTER` — `ToString`/`Parse`/`Convert` inside `Where`
- `DUPLICATED_PREDICATE` — repeated conditions in the same filter
- `FULL_ENTITY_MATERIALIZATION` — `ToList`/`ToListAsync` without prior `Select`
- Combo bonuses in batch analysis scoring for high-risk smell combinations
- `examples/structural-query-smells.cs` contract sample with integration test

### Changed

- `analyze_query_batch` scoring prioritizes structural smells (N+1, cartesian product, implicit conversion)
- README documents structural query smell categories

## [0.4.0] - 2026-06-06

### Added

- `analyze_query_batch` MCP tool for analyzing multiple C# query files/snippets in one call
- `QueryBatchAnalysisService` with per-file risk scoring and top-5 risky file ranking
- Domain types: `QueryFileInput`, `BatchAnalysisRequest`, `BatchAnalysisResult`, `FileAnalysisResult`
- `formatBatchAnalysisAsMarkdown` formatter with review order guidance
- Tests for batch analysis service and markdown formatter

### Notes

- QueryForge still does not read files from disk; the MCP client must provide file paths and contents

## [0.3.2] - 2026-06-06

### Added

- Structured rewrite guidance in `EfRewriteService`: safe/partial/no modes, applied changes, manual review list, and numbered rewrite plan
- Conceptual DateTime range example and ToString/Contains advisory notes for non-sargable smells
- Unit tests in `tests/application/ef-rewrite.service.spec.ts`

### Changed

- `suggest_ef_rewrite` no longer echoes code alone when unsafe smells are present; it returns a conservative rewrite advisor with safe auto-fixes only where appropriate (`AsNoTracking`, `Count` → `Any`)
- README documents safe fixes, partial rewrite, and conceptual plans for unsafe smells

## [0.3.1] - 2026-06-06

### Fixed

- `FUNCTION_ON_COLUMN_FILTER` now detects DateTime members (`.Year`, `.Month`, `.Day`, etc.) inside complex multiline `Where` lambdas with nested `Contains`, null-forgiving operators and nested parentheses
- `hasWhereClause` helper now extracts full `Where` bodies with balanced parentheses instead of relying on the first pattern match in the entire snippet (avoids false negatives when `.Month` appears outside the filter)

### Added

- `examples/function-on-column-query.cs` contract sample for complex non-sargable date filters
- Integration test `tests/examples/function-on-column-query.spec.ts`
- Expanded unit tests for `function-on-column-filter.rule.ts` (multiline Where, negative cases)

### Changed

- Analysis markdown report highlights non-sargable filter smells (`category: sargability`) in a dedicated summary section

## [0.3.0] - 2026-06-06

### Added

- Fifteen advanced LINQ/EF performance rules focused on sargability, materialization, pagination, ordering, projection and redundant filters
- Extended `QuerySmell` contract with optional `category`, `whyItMatters`, `rewritePlan` and `safeAutoFix` fields
- `examples/advanced-linq-query.cs` canonical sample with matching integration test
- Unit tests for every new rule (detect + safe negative case)
- `critical` severity level in domain types and analysis aggregation

### Changed

- `analyze_query` markdown output now includes category, rationale, rewrite plan and auto-fix safety when available
- README documents advanced rule groups and conservative analysis scope
- Server and package version bumped to `0.3.0`

## [0.2.1] - 2026-06-06

### Added

- GitHub Actions CI workflow (`npm ci`, `npm test`, `npm run build`) on push and pull requests to `main`

### Changed

- README reformatted with proper markdown structure and line breaks
- Documentation cleanup for open-source presentation

## [0.2.0] - 2026-06-06

### Added

- `inspect_project_stack` MCP tool for pasted `.csproj` content (no disk reads)
- `ProjectStackService` with heuristic detection of target frameworks, runtime family, query providers, and database providers
- Domain types: `DotNetRuntime`, `DatabaseProvider`, `ProjectStackInspectionRequest`, `ProjectStackInspectionResult`
- Extended `QueryProvider` with `ef6`
- Unit tests for stack inspection across .NET Framework, .NET Core, and .NET 5–10 scenarios

### Changed

- README documents runtime/provider support matrix and the new tool

## [0.1.1] - 2026-06-06

### Added

- Simplified MCP query-review MVP with `domain`, `rules`, `application`, `tools`, and `formatters` layout
- Six heuristic query smells: `TO_LIST_BEFORE_SELECT`, `MISSING_AS_NO_TRACKING`, `COUNT_GREATER_THAN_ZERO`, `PAGINATION_WITHOUT_ORDER_BY`, `UNNECESSARY_INCLUDE_WITH_PROJECTION`, `FIRST_WITHOUT_ORDER_BY`
- MCP tools: `analyze_query`, `suggest_ef_rewrite`, `suggest_dapper_alternative`, `generate_review_report`
- Unit tests for all rules, application services, and the canonical `examples/bad-ef-query.cs` sample
- Fictional English examples using generic domains (`Product`, `Category`, `Order`, etc.)

### Changed

- Build pipeline migrated from `tsup` to `tsc`
- Dapper suggestion template sanitized to English open-source-friendly examples

### Removed

- Legacy architecture (`src/core`, `src/mcp`, `src/shared`)
- Removed tools: `inspect_project_stack`, `optimize_existing_query`, `compare_ef_vs_dapper`, `suggest_indexes`
- Old docs, fixtures, and integration tests tied to the previous architecture

## [0.1.0] - 2026-05-24

### Added

- Initial local-first MVP release
- MCP stdio server for local Cursor setup
- `inspect_project_stack` tool
- `optimize_existing_query` tool with 15 EF/LINQ query smells
- Conservative EF query optimization (AsNoTracking, Select reorder, Count→Any)
- `suggest_dapper_alternative` tool with relational provider guards
- `compare_ef_vs_dapper` tool
- `suggest_indexes` tool with provider guards
- Extensible EF provider detection and provider family classification
- Provider capabilities and conservative analysis policy
- Documentation: README, examples, query smells, limitations, production usage, contributing
- Test suite (unit + integration) with .NET fixtures

[0.6.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.6.1
[0.6.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.6.0
[0.5.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.5.0
[0.4.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.4.0
[0.3.2]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.3.2
[0.3.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.3.1
[0.3.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.3.0
[0.2.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.2.1
[0.2.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.2.0
[0.1.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.1.0
