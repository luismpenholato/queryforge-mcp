# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/luismpenholato/queryforge-mcp/releases/tag/v0.1.0
