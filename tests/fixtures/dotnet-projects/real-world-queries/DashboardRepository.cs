using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: multiple smells, strict mode, rewritePlan, high behaviorRisk, no auto Include removal
public class DashboardRepository
{
    private readonly AppDbContext _context;

    public DashboardRepository(AppDbContext context) => _context = context;

    public async Task<DashboardDto> GetDashboardAsync(int customerId)
    {
        var orders = await _context.Orders
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .Where(x => x.CustomerId == customerId)
            .ToListAsync();

        return new DashboardDto
        {
            Total = orders.Count,
            Paid = orders.Count(x => x.Payments.Any(p => p.Paid))
        };
    }
}

public class DashboardDto
{
    public int Total { get; set; }
    public int Paid { get; set; }
}

public class Payment
{
    public bool Paid { get; set; }
}

public partial class Order
{
    public int CustomerId { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
}

public class OrderItem
{
    public int Id { get; set; }
}
