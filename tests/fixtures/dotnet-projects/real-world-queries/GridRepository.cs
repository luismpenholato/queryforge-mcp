using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: strict mode, no optimizedEfCode, rewritePlan with pagination/materialization items, MANUAL_REVIEW or EF_OPTIMIZED without code
public class GridRepository
{
    private readonly AppDbContext _context;

    public GridRepository(AppDbContext context) => _context = context;

    public async Task<List<OrderGridDto>> GetGridAsync(int skip, int take, bool activeOnly)
    {
        var query = _context.Orders.AsQueryable();
        if (activeOnly)
            query = query.Where(x => x.Active);

        var rows = await query.ToListAsync();
        return rows.Skip(skip).Take(take).Select(x => new OrderGridDto
        {
            Id = x.Id,
            CustomerName = x.Customer.Name
        }).ToList();
    }
}

public class OrderGridDto
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
}

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions options) : base(options) { }
    public DbSet<Order> Orders => Set<Order>();
}

public class Order
{
    public int Id { get; set; }
    public bool Active { get; set; }
    public Customer Customer { get; set; } = null!;
}

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
