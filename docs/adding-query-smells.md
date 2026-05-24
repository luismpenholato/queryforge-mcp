# Adding Query Smells

This guide explains how to add a new EF/LINQ query smell to QueryForge MCP.

## Where smells live

| File | Purpose |
|------|---------|
| `src/core/query-analysis/query-smell.types.ts` | Smell type union + `QuerySmell` interface |
| `src/core/query-analysis/linq-pattern-analyzer.ts` | Detection heuristics |
| `src/core/query-analysis/query-smell-detector.ts` | Stack/version/provider enhancements |
| `src/core/query-analysis/query-smell-definitions.ts` | Metadata catalog |
| `docs/query-smells.md` | User-facing documentation |

## Step 1: Define the smell type

Add a new value to `QuerySmellType` in `query-smell.types.ts`:

```typescript
| "MY_NEW_SMELL"
```

## Step 2: Implement detection

Add detection logic in `analyzeLinqForSmells()` or a helper in `linq-pattern-analyzer.ts`:

```typescript
smells.push({
  type: "MY_NEW_SMELL",
  severity: "medium",
  message: "Clear description of the problem.",
  impact: "Why it hurts performance or correctness.",
  suggestion: "Conservative recommendation.",
  evidence: "Optional supporting detail.",
});
```

### Required fields

Every smell must include:

- `type`
- `severity` — `low`, `medium`, or `high`
- `message`
- `impact`
- `suggestion`

Optional:

- `evidence`

## Step 3: Provider and version context

If the smell is relational-specific:

- Ensure `applyProviderSmellPolicy()` in `provider-policy.ts` adapts or filters it for Document/InMemory/Custom/Unknown providers
- Add version notes in `query-smell-detector.ts` when EF version limits the suggestion (e.g. `AsSplitQuery` only on EF Core 5+)

## Step 4: When to mark needsManualReview

Set `needsManualReview: true` at the **optimization result** level (in `ef-query-optimizer.ts`) when:

- Automatic rewrite could change behavior
- Provider semantics are uncertain
- Large `Contains`, custom methods in `Where`, or function-on-column rewrites are involved

Do **not** auto-rewrite these cases — return textual suggestions only.

## Step 5: Add optimization rule (optional)

If a safe automatic rewrite exists:

1. Add transform in `src/core/query-optimization/ef-query-optimizer.ts`
2. Record transformation in `appliedTransformations`
3. Add unit test in `tests/unit/core/query-optimization/ef-query-optimizer.test.ts`

## Step 6: Add unit test

Create or extend `tests/unit/core/query-analysis/query-smell-detector.test.ts`:

```typescript
it("should detect MY_NEW_SMELL", () => {
  const code = `...`;
  const analysis = analyzeQuery(code);
  expect(analysis.smells.some((s) => s.type === "MY_NEW_SMELL")).toBe(true);
});
```

Include a negative test when false positives are a risk.

## Step 7: Document

Add a section to `docs/query-smells.md` with:

- Problem description
- Bad example
- Suggestion
- When manual review is required

Optionally add a before/after example to `docs/examples.md`.

## Severity guidelines

| Severity | Use when |
|----------|----------|
| `high` | Large unnecessary data load, client evaluation risk, non-deterministic pagination |
| `medium` | Missing AsNoTracking, index-unfriendly filters, redundant Include |
| `low` | Minor opportunities (Count vs Any, FirstOrDefault without OrderBy) |

## Checklist

- [ ] Type added to `query-smell.types.ts`
- [ ] Detection implemented with message/impact/suggestion
- [ ] Provider guards reviewed
- [ ] Version notes added if needed
- [ ] Unit test added
- [ ] Documented in `docs/query-smells.md`
- [ ] Optional safe rewrite + optimizer test
