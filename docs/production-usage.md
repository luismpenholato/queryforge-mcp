# Production usage guidelines

QueryForge MCP is **code review assistance**, not an autonomous optimizer. Use these guidelines in real projects.

## Default to strict mode

```json
{
  "projectPath": "C:/dev/meu-projeto-dotnet",
  "code": "...",
  "mode": "strict",
  "preserveBehavior": true
}
```

In **strict** mode:

- No consolidated `optimizedEfCode` is emitted
- You receive `problems`, `rewritePlan`, and `behaviorPreservation`
- Apply changes manually after review

Use **safe** mode only for simple, high-confidence cases when you explicitly want auto-rewrites:

```json
{
  "mode": "safe",
  "rewriteCode": true
}
```

Safe mode may emit `optimizedEfCode` only when all auto-applied steps are high confidence. For anything non-trivial, stay in strict.

## Treat output as review input

- Read each smell's `needsManualReview`, `confidence`, and `canAutoFix`
- Follow `rewritePlan` items one by one — do not paste the whole plan blindly
- Prefer textual suggestions when `canAutoFix=false`
- Stop when `behaviorPreservation.behaviorRisk` is `high`

## Never apply suggestions without tests

- Run your project's unit and integration tests
- Compare row counts and key fields on staging
- Validate pagination, ordering, and null semantics
- QueryForge does not execute your application — you must verify behavior

## Validate generated SQL

When possible:

- Enable EF Core logging or use `ToQueryString()`
- Compare SQL before and after proposed changes
- Confirm server-side translation (no unexpected client evaluation)

## Validate execution plans

For critical queries on relational providers:

- Capture execution plan before changes
- Capture execution plan after changes
- Apply index suggestions only after DBA/plan review

## Prefer optimized EF before Dapper

- EF keeps consistency with your existing codebase
- Dapper is suggested only for read-only, high-risk, relational scenarios
- When Dapper is recommended, `needsManualReview` should be true
- Never switch tracking/update flows to Dapper based on MCP output alone

## When to consider Dapper

Consider Dapper only when:

- The query is read-only and performance-critical
- EF optimization cannot address the issue safely
- Dapper is already in the project (or you consciously add it)
- Provider family is Relational with adequate support level

## When to stop and escalate manually

Stop auto-applying suggestions when:

- `behaviorPreservation.behaviorRisk` is `high`
- Multiple smells have `needsManualReview=true`
- Provider is Document, InMemory, Custom, or Unknown
- Query uses dynamic filters, joins, or multi-step variables
- Query uses raw SQL, stored procedures, or heavy dynamic LINQ

## Checklist for critical queries

Use this checklist before adopting suggestions in production.

### 1. Inspect the project stack

Run `inspect_project_stack` with your repository root or solution folder.

Verify:

- [ ] Target frameworks detected correctly
- [ ] EF kind and version match your project
- [ ] Database provider and `providerFamily` are correct
- [ ] Dapper presence matches reality
- [ ] Warnings and limitations are understood

### 2. Analyze the query

For each query under review:

- [ ] Paste the full method or relevant snippet as `code`
- [ ] Set `mode: "strict"` and `preserveBehavior: true`
- [ ] Review `problems` — do smells match your intent?
- [ ] Check `behaviorPreservation.behaviorRisk` and per-smell `needsManualReview`
- [ ] Read `versionNotes` for EF/provider constraints

### 3. Compare behavior

- [ ] Run existing automated tests
- [ ] Compare row counts and key fields on staging
- [ ] Check null handling and ordering semantics
- [ ] Verify pagination returns the same pages with the same `OrderBy`

### 4. Validate SQL and execution plans

- [ ] Compare SQL before and after suggested changes
- [ ] Confirm filters and projections moved to the server when expected
- [ ] Capture and compare execution plans for relational providers
- [ ] Do not apply `CREATE INDEX` scripts without DBA review

### 5. Document the decision

- [ ] Accepted suggestion — link to PR
- [ ] Rejected suggestion — note why (behavior, provider, complexity)
- [ ] Deferred — needs profiling or parser follow-up

See also [limitations.md](./limitations.md) and [SECURITY.md](../SECURITY.md).
