# Examples

Real-world examples of QueryForge MCP analysis and suggestions.

## 1. ToList Before Select (Early Materialization)

**Problem:** Full entity materialization before DTO projection.

```csharp
var data = await _context.Orders.Where(x => x.Active).ToListAsync();
return data.Select(x => new OrderDto { Id = x.Id }).ToList();
```

**After (conservative rewrite when safe):**

```csharp
return await _context.Orders
    .Where(x => x.Active)
    .Select(x => new OrderDto { Id = x.Id })
    .ToListAsync();
```

## 2. DTO Projection After Materialization

**Problem:** Entities loaded when only DTO shape is needed.

```csharp
var customers = await _context.Customers
    .Include(x => x.Orders)
    .Where(x => x.Active)
    .ToListAsync();

return customers.Select(x => new CustomerDto
{
    Id = x.Id,
    Name = x.Name,
    TotalOrders = x.Orders.Count
}).ToList();
```

**Suggestion:** Move `Select` before `ToListAsync` and project `Count()` in SQL when supported.

## 3. Missing AsNoTracking

**Problem:** Read-only query tracks entities unnecessarily.

```csharp
return await _context.Products.Where(x => x.InStock).ToListAsync();
```

**After:**

```csharp
return await _context.Products
    .AsNoTracking()
    .Where(x => x.InStock)
    .ToListAsync();
```

## 4. Count > 0 vs Any()

**Problem:** Count scans more rows than needed for boolean check.

```csharp
if (await _context.Orders.CountAsync() > 0) { ... }
```

**After:**

```csharp
if (await _context.Orders.AnyAsync()) { ... }
```

## 5. Pagination in Database

**Problem:** Pagination applied in memory.

```csharp
var dados = await query.ToListAsync();
return dados.Skip(skip).Take(take).ToList();
```

**After:**

```csharp
return await query
    .OrderBy(x => x.Id)
    .Skip(skip)
    .Take(take)
    .ToListAsync();
```

## 6. Contains With Many IDs

**Problem:** Large IN clause degrades performance.

```csharp
return await _context.Orders
    .Where(x => orderIds.Contains(x.Id))
    .ToListAsync();
```

**Suggestion:** Consider batching, TVP, or temp table (`needsManualReview=true`). No automatic rewrite.

## 7. Multiple Collection Includes

**Problem:** Cartesian explosion risk with multiple collection eager loads.

```csharp
return await _context.Pedidos
    .Include(x => x.Itens)
    .Include(x => x.Pagamentos)
    .Include(x => x.Anexos)
    .ToListAsync();
```

**Suggestion (EF Core 5+):** Consider `AsSplitQuery()` when all includes are required. Not suggested for EF Core 2.x.

## 8. MongoDB Provider Guard

**Problem:** Relational recommendations do not apply to document providers.

```csharp
return await _context.Pedidos
    .Include(x => x.Itens)
    .Include(x => x.Pagamentos)
    .ToListAsync();
```

**QueryForge behavior with MongoDB:**

- `analysisMode: generic_conservative`
- No Dapper/SQL index suggestions
- `MULTIPLE_COLLECTION_INCLUDES` relational smell filtered/adapted
- `needsManualReview: true`

## 9. Unnecessary Include With Projection

**Problem:** Include loads full graph when projection handles navigation.

```csharp
return await _context.Customers
    .Include(c => c.Orders)
    .Select(c => new CustomerDto { Id = c.Id, OrderCount = c.Orders.Count() })
    .ToListAsync();
```

**Suggestion:** Remove redundant Include when navigation is accessed only inside Select.

## 10. Skip/Take Without OrderBy

**Problem:** Non-deterministic pagination.

```csharp
return await _context.Items.Skip(20).Take(10).ToListAsync();
```

**Suggestion:** Add OrderBy before Skip/Take (manual column selection required).

## 11. Dapper for Read-Only Report

**Problem:** Complex read-only report with multiple joins.

```csharp
return await _context.Orders
    .Include(o => o.Customer)
    .Include(o => o.Items)
    .Where(o => o.Status == "Completed")
    .Select(o => new ReportDto { ... })
    .ToListAsync();
```

**Suggestion:** Consider Dapper with parameterized SQL when Dapper is already in the project and EF optimization is insufficient.

## 12. Index Suggestion

**Query filters:**

```csharp
.Where(x => x.CustomerId == id && x.Status == "Active")
.OrderByDescending(x => x.CreatedAt)
```

**Suggested index (SQL Server):**

```sql
CREATE INDEX IX_Orders_CustomerId_Status_CreatedAt
ON Orders (CustomerId, Status, CreatedAt DESC);
```

Always validate with execution plan before applying.

See also [query-smells.md](./query-smells.md) for the full smell catalog.
