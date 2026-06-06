# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.2]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.3.2
[0.3.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.3.1
[0.3.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.3.0
[0.2.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.2.1
[0.2.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.2.0
[0.1.1]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.1.0
