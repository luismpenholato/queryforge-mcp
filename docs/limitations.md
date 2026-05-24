# Limitations

QueryForge MCP v0.1.0 is an MVP focused on **safe, conservative guidance**. Understand these limits before relying on it in production.

## Heuristic analysis (not Roslyn)

- Detection uses regex and tokenization, not a full C# parser
- Complex LINQ (multi-method chains, shared helpers, dynamic predicates) may be partially analyzed or missed
- Roslyn or tree-sitter integration is planned for a future release
- Do not assume semantic proof of query equivalence

## Does not understand all complex flows

- Multi-step queries across variables and helper methods may be incomplete
- Dynamic filters, raw SQL, and stored procedures require manual review
- EF6 support is basic in v0.1

## Not a profiler

- QueryForge does not measure runtime latency, CPU, or memory
- It does not replace SQL Server Profiler, dotTrace, Application Insights, or EF logging
- Suggestions indicate *likely* issues, not proven bottlenecks

## No performance guarantees

- Index suggestions are starting points only
- Always validate with your database execution plan before creating indexes
- EF translation varies by provider and version
- **Strict mode is the recommended default** — it avoids consolidated auto-rewrites

## False positives and false negatives

- Heuristics can flag issues that are acceptable in your context
- Some real problems may not be detected
- Use `needsManualReview`, `confidence`, and `canAutoFix` to calibrate trust

## Analysis modes

| Mode | Behavior |
|------|----------|
| **strict** (default, recommended) | Analysis + `rewritePlan` only; `optimizedEfCode` is null |
| **safe** | May emit `optimizedEfCode` only when all auto-applied steps are high confidence |

Use **strict** unless you have a simple query and explicitly need safe-mode rewrites.

## Provider coverage

| Provider family | Analysis mode |
|-----------------|---------------|
| Relational | Standard relational heuristics |
| Document (MongoDB, Cosmos) | Generic conservative — no SQL/Dapper/index SQL |
| InMemory | Generic + non-representative performance warning |
| Custom / Unknown | Generic conservative only |

## What v0.1 does well

- Detect common EF/LINQ smells (early materialization, AsNoTracking, Include+projection, pagination, Count vs Any)
- Inspect .NET project stack (TFM, EF version, provider, Dapper)
- Suggest conservative EF rewrites via `rewritePlan`
- Block inappropriate relational recommendations for document providers

## Recommended workflow

Use QueryForge as the **first pass** in code review, then validate with:

1. EF Core logging / SQL output
2. Execution plans
3. Automated tests in your application
4. [production-usage.md](./production-usage.md) checklist

See [roadmap.md](./roadmap.md) for planned improvements.
