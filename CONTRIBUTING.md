# Contributing to QueryForge MCP

Thank you for helping improve QueryForge MCP. This project prioritizes **safe, conservative analysis** over aggressive rewrites.

## Development setup

```bash
git clone https://github.com/luismpenholato/queryforge-mcp.git
cd queryforge-mcp
npm install
```

## Required checks before opening a PR

```bash
npm run typecheck
npm test
npm run build
```

Optional during development:

```bash
npm run dev          # run MCP server on stdio
npm run test:watch   # watch mode
```

## Project layout

```
src/
  mcp/          # MCP protocol, schemas, thin tool wrappers
  core/         # business logic (no MCP SDK imports)
  shared/       # fs, security, text helpers
tests/
  unit/         # core and MCP unit tests
  integration/  # MCP tool integration tests
  fixtures/     # .NET sample projects
docs/           # user and contributor documentation
```

## Adding a new provider

See [docs/adding-providers.md](docs/adding-providers.md).

Summary:

1. Add package mapping in `src/core/providers/provider-registry.ts`
2. Define capabilities in `src/core/providers/provider-capabilities.ts`
3. Update provider policy guards in `src/core/providers/provider-policy.ts` if needed
4. Add fixture under `tests/fixtures/dotnet-projects/providers/<name>/`
5. Add tests in `tests/unit/core/provider-detector.test.ts`

## Adding a new query smell

See [docs/adding-query-smells.md](docs/adding-query-smells.md).

Summary:

1. Add smell type in `src/core/query-analysis/query-smell.types.ts`
2. Implement detection in `src/core/query-analysis/linq-pattern-analyzer.ts`
3. Add version/provider context in `src/core/query-analysis/query-smell-detector.ts` if needed
4. Document in `docs/query-smells.md`
5. Add unit test in `tests/unit/core/query-analysis/`

## Adding a new optimization rule

1. Implement conservative transform in `src/core/query-optimization/ef-query-optimizer.ts`
2. Never rewrite when behavior equivalence is uncertain — set `needsManualReview: true`
3. Respect provider policy (`shouldSkipRelationalOptimizations`, `shouldSkipIncludeRemoval`)
4. Add unit test in `tests/unit/core/query-optimization/`
5. Add integration example if the MCP tool output changes

## Creating a .NET fixture

Fixtures live in `tests/fixtures/dotnet-projects/`.

Rules:

- Include only source/project files (`.csproj`, optional `.cs`, `packages.config`)
- Do **not** commit `bin/` or `obj/`
- Keep fixtures minimal — only what is needed to detect EF/provider/Dapper
- Name folders by scenario, e.g. `ef-core-6-sqlserver`, `providers/mongodb`

Example:

```
tests/fixtures/dotnet-projects/providers/mongodb/
  App.csproj
```

## Pull request expectations

1. **Focused scope** — one feature or fix per PR when possible
2. **Tests** — new behavior must include tests
3. **Docs** — update relevant docs (`query-smells.md`, `examples.md`, README) when user-facing behavior changes
4. **Conservative by default** — preserve behavior; prefer suggestions over automatic rewrites
5. **No secrets** — never commit `.env`, credentials, or connection strings
6. **Clean CI** — `typecheck`, `test`, and `build` must pass

## Code style

- TypeScript strict mode
- Match existing naming and file structure
- Core must not import `@modelcontextprotocol/sdk`
- MCP tools stay thin: validate → call core → format response
- Avoid logging to stdout (MCP uses stdio transport)

## Questions

Open a GitHub issue for design questions before large refactors.
