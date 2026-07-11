# Contributing to QueryForge MCP

Thank you for helping improve QueryForge MCP. This project prioritizes **safe, conservative analysis** over aggressive rewrites.

By participating in this project, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

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

## Issues

Before opening an issue:

- Search existing issues.
- Use a minimal fictional reproduction.
- Do not include proprietary code, credentials, connection strings or customer data.
- Use [GitHub Security Advisories](https://github.com/luismpenholato/queryforge-mcp/security/advisories) for security vulnerabilities.

## Pull requests

- Keep changes focused.
- Add or update tests when behavior changes.
- Run `npm run validate`.
- Update documentation and changelog when applicable.

## Adding a new query rule

1. Create `src/rules/<rule-name>.rule.ts` implementing `QueryRule`
2. Register the rule in `src/rules/index.ts`
3. Add `tests/rules/<rule-name>.rule.spec.ts` with:
   - at least one case that detects the smell
   - at least one case that does not false-positive on correct code
4. Use fictional English domain names in examples (`Product`, `Category`, `Order`, `Customer`, etc.)
5. Do not use Portuguese or company-specific entity names in tests or examples

## Code style

- TypeScript strict mode with `NodeNext` module resolution
- Use `.js` extensions in relative imports
- Keep rules isolated and regex/heuristic-based unless there is a strong reason otherwise
- MCP tools stay thin: validate input → call service → return text content
- Avoid logging to stdout (MCP uses stdio transport)
- Unit tests must not depend on `dist/`; compiled artifact checks belong in `scripts/validate-public-api.mjs`

## Questions

Open a GitHub issue for design questions before large refactors.
