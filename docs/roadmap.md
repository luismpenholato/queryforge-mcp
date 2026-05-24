# Roadmap

QueryForge MCP is a **local-first** MCP server. v0.1 focuses on GitHub distribution and Cursor local setup. npm and MCP Registry publishing are planned for later.

## v0.1 — Local-first MVP

- [x] MCP stdio server
- [x] Local Cursor setup
- [x] `inspect_project_stack`
- [x] `optimize_existing_query` strict/safe
- [x] Provider detection
- [x] Dapper guard
- [x] Index guard
- [x] Production hardening
- [x] Documentation
- [x] Tests

## v0.2 — Real-world improvements

- [ ] More real-world query fixtures
- [ ] Better Dapper and index suggestions
- [ ] Improved provider-specific notes

## v0.3 — Parser (optional)

- [ ] Optional C# parser via tree-sitter or Roslyn bridge
- [ ] Better LINQ chain tracking across variables
- [ ] Multi-method query analysis
- [ ] Improved EF6 support

## v1.0 — Stable API

- [ ] Stable public MCP tool API
- [ ] Hardened security review
- [ ] Real-world validation suite
- [ ] Complete provider documentation matrix

## Later

- npm publishing
- MCP Registry publishing

## Non-goals (for now)

- Executing SQL or connecting to databases
- Automatic file modification in user projects
- Replacing profilers or APM tools

See also [limitations.md](./limitations.md) and [production-usage.md](./production-usage.md).
