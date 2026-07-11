# Contributing to QueryForge MCP

Thank you for helping improve QueryForge MCP. This project prioritizes **safe, conservative analysis** over aggressive rewrites.

## Development setup

Requirements:

- Node.js 20+

```bash
git clone https://github.com/luismpenholato/queryforge-mcp.git
cd queryforge-mcp
npm ci
npm test
npm run build
npm run validate
```

Optional during development:

```bash
npm run dev    # run MCP server on stdio
```

## Project layout

```
src/
  domain/        # types and contracts
  rules/         # isolated query smell rules
  application/   # analysis, rewrite, and report services
  tools/         # MCP tool registrations
  formatters/    # output formatters
  public-api.ts  # programmatic library entrypoint
  index.ts       # stdio entrypoint
  server.ts      # MCP server setup
tests/
  rules/         # unit tests per rule
  application/   # service tests
  public-api/    # source-level public API tests
  examples/      # canonical example coverage
examples/        # sample C# queries
```

## Adding a new query rule

1. Create `src/rules/<rule-name>.rule.ts` implementing `QueryRule`
2. Register the rule in `src/rules/index.ts`
3. Add `tests/rules/<rule-name>.rule.spec.ts` with:
   - at least one case that detects the smell
   - at least one case that does not false-positive on correct code
4. Use fictional English domain names in examples (`Product`, `Category`, `Order`, `Customer`, etc.)
5. Do not use Portuguese or company-specific entity names in tests or examples

## Pull request expectations

1. **Focused scope** — one feature or fix per PR when possible
2. **Tests** — new rules and services must include tests
3. **Docs** — update README or CHANGELOG when user-facing behavior changes
4. **Conservative by default** — preserve behavior; prefer suggestions over automatic rewrites
5. **No secrets** — never commit `.env`, credentials, or connection strings
6. **Clean checks** — `npm run validate` must pass

## Code style

- TypeScript strict mode with `NodeNext` module resolution
- Use `.js` extensions in relative imports
- Keep rules isolated and regex/heuristic-based unless there is a strong reason otherwise
- MCP tools stay thin: validate input → call service → return text content
- Avoid logging to stdout (MCP uses stdio transport)
- Unit tests must not depend on `dist/`; compiled artifact checks belong in `scripts/validate-public-api.mjs`

## Questions

Open a GitHub issue for design questions before large refactors.
