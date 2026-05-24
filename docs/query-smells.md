# Query Smells

Catálogo de smells detectados pelo QueryForge MCP para queries EF/LINQ. Todas as sugestões são conservadoras: preservar comportamento antes de otimizar.

## EARLY_MATERIALIZATION

**Problema:** `ToList`, `ToListAsync`, `ToArray`, `ToArrayAsync` ou `AsEnumerable` ocorre antes de `Where`, `Select`, `Skip`, `Take`, `OrderBy` ou `GroupBy`.

**Exemplo ruim:**

```csharp
var dados = await _context.Clientes.ToListAsync();
return dados.Where(x => x.Ativo).Select(x => x.Nome).ToList();
```

**Sugestão:** Manter `IQueryable` até aplicar filtros/projeção e materializar apenas no final.

**Manual review:** Não, salvo quando a ordem afeta semântica de null ou side effects.

---

## DTO_PROJECTION_AFTER_MATERIALIZATION

**Problema:** Projeção para DTO acontece depois de materializar entidades.

**Exemplo ruim:**

```csharp
var items = await _context.Orders.ToListAsync();
return items.Select(x => new OrderDto { Id = x.Id }).ToList();
```

**Sugestão:** Mover `Select` para antes de `ToListAsync`.

**Manual review:** Sim, se a projeção em memória tiver lógica não traduzível para SQL.

---

## MISSING_AS_NO_TRACKING

**Problema:** Consulta aparentemente read-only sem `AsNoTracking`.

**Exemplo ruim:**

```csharp
return await _context.Products.Where(x => x.InStock).ToListAsync();
```

**Sugestão:** Adicionar `.AsNoTracking()` quando a entidade não será alterada depois.

**Manual review:** Sim, se houver `Update`, `Attach`, `Entry`, `SaveChanges` ou mutação de propriedade após o carregamento.

---

## UNNECESSARY_INCLUDE_WITH_PROJECTION

**Problema:** `Include` usado junto com `Select` para DTO quando a projeção já acessa navegações.

**Exemplo ruim:**

```csharp
return await _context.Pedidos
    .Include(x => x.Cliente)
    .Select(x => new PedidoDto { ClienteNome = x.Cliente.Nome })
    .ToListAsync();
```

**Sugestão:** Remover `Include` redundante quando a projeção acessa navegação diretamente.

**Manual review:** Sim, se a entidade for retornada ou se navegação for usada fora da query.

---

## MULTIPLE_COLLECTION_INCLUDES

**Problema:** Múltiplos `Include` de coleções (risco de cartesian explosion).

**Exemplo ruim:**

```csharp
return await _context.Pedidos
    .Include(x => x.Itens)
    .Include(x => x.Pagamentos)
    .Include(x => x.Anexos)
    .ToListAsync();
```

**Sugestão:** Revisar necessidade de todos os includes; em EF Core 5+, considerar `AsSplitQuery()` quando aplicável.

**Manual review:** Sim, para escolher entre split query, projeção ou carregamento explícito.

---

## IN_MEMORY_PAGINATION

**Problema:** `Skip`/`Take` aplicados depois de materialização.

**Exemplo ruim:**

```csharp
var dados = await query.ToListAsync();
return dados.Skip(skip).Take(take).ToList();
```

**Sugestão:** Aplicar `OrderBy`/`Skip`/`Take` antes de `ToListAsync`.

**Manual review:** Não, quando o padrão for simples.

---

## SKIP_TAKE_WITHOUT_ORDER_BY

**Problema:** `Skip` ou `Take` sem `OrderBy` determinístico anterior.

**Exemplo ruim:**

```csharp
return await _context.Items.Skip(20).Take(10).ToListAsync();
```

**Sugestão:** Adicionar `OrderBy` antes da paginação.

**Manual review:** Sim, para escolher a coluna/chave correta de ordenação.

---

## COUNT_GREATER_THAN_ZERO

**Problema:** `Count() > 0`, `CountAsync() > 0`, `Count() == 0` ou `CountAsync() == 0` usados só para existência.

**Exemplo ruim:**

```csharp
if (await _context.Orders.CountAsync() > 0) { ... }
```

**Sugestão:** Usar `Any()`/`AnyAsync()` ou `!Any()`/`!AnyAsync()` preservando a lógica.

**Manual review:** Não alterar quando o valor numérico de `Count` é realmente usado.

---

## LARGE_CONTAINS_RISK

**Problema:** `Contains` com lista externa de IDs ou coleção potencialmente grande.

**Exemplo ruim:**

```csharp
return await _context.Orders
    .Where(x => customerIds.Contains(x.CustomerId))
    .ToListAsync();
```

**Sugestão:** Alertar sobre risco; em SQL Server, considerar batches, TVP ou tabela temporária.

**Manual review:** Sempre — não há reescrita automática segura.

---

## FUNCTION_ON_FILTERED_COLUMN

**Problema:** Função aplicada à coluna dentro de `Where` (`ToLower`, `Trim`, `ToString`, `Date`, `Convert.To...`).

**Exemplo ruim:**

```csharp
.Where(x => x.Nome.ToLower() == nome.ToLower())
```

**Sugestão:** Normalização prévia, collation adequada ou coluna normalizada persistida.

**Manual review:** Sim — reescrita automática não é aplicada.

---

## CUSTOM_METHOD_IN_WHERE

**Problema:** Método customizado dentro de `Where`.

**Exemplo ruim:**

```csharp
.Where(x => Normalizar(x.Nome) == nome)
```

**Sugestão:** Garantir tradução para SQL ou mover lógica para o servidor.

**Manual review:** Sempre.

---

## GROUP_BY_NAVIGATION_OR_OBJECT

**Problema:** `GroupBy` com navegação ou objeto complexo como chave.

**Exemplo ruim:**

```csharp
.GroupBy(x => x.Cliente)
.GroupBy(x => new { x.Cliente, x.Produto })
```

**Sugestão:** Preferir chaves escalares (`GroupBy(x => x.ClienteId)`).

**Manual review:** Sim, quando a chave composta for requisito de negócio.

---

## FIRST_OR_DEFAULT_WITHOUT_ORDER

**Problema:** `FirstOrDefault`/`FirstOrDefaultAsync` com filtro mas sem `OrderBy`.

**Exemplo ruim:**

```csharp
return await _context.Orders
    .Where(x => x.Active)
    .FirstOrDefaultAsync();
```

**Sugestão:** Adicionar `OrderBy` se a regra de negócio exige registro determinístico.

**Manual review:** Opcional — severidade baixa/média.

---

## SELECT_STAR_OR_ENTITY_LOAD_FOR_DTO

**Problema:** Carrega entidade completa e converte para DTO depois.

**Exemplo ruim:**

```csharp
var entities = await _context.Customers.ToListAsync();
return entities.Select(x => new CustomerDto { Id = x.Id }).ToList();
```

**Sugestão:** Projetar diretamente no banco com `Select`.

**Manual review:** Sim, se houver lógica pós-carregamento não traduzível.

---

## PROVIDER_FAMILY_GUARD

**Problema:** Regras relacionais aplicadas em provider inadequado.

**Comportamento:**

| Família | Análise |
|---------|---------|
| Relational | Análise relacional completa |
| Document (MongoDB/Cosmos) | Análise genérica; sem SQL/Dapper/CREATE INDEX |
| InMemory | Warning de performance não representativa |
| Custom/Unknown | Apenas análise genérica conservadora |

**Manual review:** Sempre para Document/InMemory/Custom/Unknown quando smells persistirem.
