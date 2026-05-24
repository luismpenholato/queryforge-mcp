# Adding Providers

This guide explains how to extend QueryForge MCP provider detection and capabilities.

## Architecture overview

| File | Responsibility |
|------|----------------|
| `src/core/providers/provider-registry.ts` | Maps NuGet package names → `DatabaseProvider` |
| `src/core/providers/provider-capabilities.ts` | Dapper/index/SQL capability per provider |
| `src/core/providers/provider-policy.ts` | Conservative guards by `providerFamily` |
| `src/core/project-stack/provider-detector.ts` | Combines packages + config hints |
| `src/core/providers/provider.types.ts` | Shared types and enums |

## Step 1: Register the package

Edit `src/core/providers/provider-registry.ts` and add an entry to `PROVIDER_PACKAGE_MAP`:

```typescript
"My.Provider.EntityFrameworkCore": {
  provider: "MyProvider",
  providerFamily: "Relational",
  supportLevel: "supported",
  confidence: "high",
},
```

If the package is unknown, QueryForge falls back to `Custom` or `Unknown`.

## Step 2: Add provider enum value (if new)

If introducing a new `DatabaseProvider` value, add it to:

- `src/core/providers/provider.types.ts` (`DatabaseProvider`, `DATABASE_PROVIDER_VALUES`)
- MCP schemas that expose provider enums (`src/mcp/schemas/provider.schema.ts`)

## Step 3: Classify providerFamily

Choose the closest family:

| Family | Examples | Relational analysis |
|--------|----------|---------------------|
| `Relational` | SQL Server, PostgreSQL, MySQL | Full |
| `Document` | MongoDB, Cosmos, RavenDB | Generic conservative |
| `InMemory` | EF InMemory | Generic + performance warning |
| `Analytical` | Snowflake, ClickHouse | Best-effort |
| `Custom` | Proprietary providers | Generic only |
| `Unknown` | Undetected | Generic only |

## Step 4: Define supportLevel

| Level | Meaning |
|-------|---------|
| `first_class` | Full relational tooling, high confidence |
| `supported` | Standard analysis, good confidence |
| `best_effort` | Detection works; suggestions may be limited |
| `detection_only` | Detected but minimal provider-specific logic |
| `custom` / `unknown` | Generic conservative analysis |

## Step 5: Define Dapper capability

In `src/core/providers/provider-capabilities.ts`, update `getDapperCapability()`:

- Relational providers: usually `allowed: true`
- Document/InMemory/Custom/Unknown: `allowed: false` with reason

Dapper suggestions are blocked by `shouldBlockDapperSuggestion()` in `provider-policy.ts`.

## Step 6: Define index capability

In `src/core/providers/provider-capabilities.ts`, update index/SQL helpers:

- Relational: may suggest `CREATE INDEX` patterns (still requires manual validation)
- Document: no SQL `CREATE INDEX`
- Custom/Unknown: generic notes only

Use `shouldBlockCreateIndexSql()` and `shouldBlockIndexSuggestions()` from `provider-policy.ts`.

## Step 7: Add tests

1. Create fixture:

```
tests/fixtures/dotnet-projects/providers/myprovider/App.csproj
```

2. Add test case in `tests/unit/core/provider-detector.test.ts`

3. If policy differs, add tests in `tests/unit/core/provider-capabilities.test.ts`

## Step 8: Document

Update README provider matrix and mention limitations for the new provider if applicable.

## Checklist

- [ ] Package mapped in `provider-registry.ts`
- [ ] `providerFamily` and `supportLevel` set
- [ ] Dapper capability defined
- [ ] Index/SQL capability defined
- [ ] Policy guards reviewed in `provider-policy.ts`
- [ ] Fixture + tests added
- [ ] README updated if user-facing
