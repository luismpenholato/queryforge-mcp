using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: complex query, strict mode, no optimizedEfCode, manual review
public class ReportRepository
{
    private readonly AppDbContext _context;

    public ReportRepository(AppDbContext context) => _context = context;

    public async Task<ReportDto> GetReportAsync()
    {
        var baseQuery = _context.Orders.Where(x => x.Active);
        var materialized = await baseQuery.ToListAsync();
        var filtered = materialized.Where(x => x.Customer.Region == "South");
        var grouped = filtered.GroupBy(x => x.Customer).Select(g => new { g.Key, Count = g.Count() });
        return new ReportDto { Rows = grouped.Count() };
    }
}

public class ReportDto
{
    public int Rows { get; set; }
}

public partial class Customer
{
    public string Region { get; set; } = "";
}
