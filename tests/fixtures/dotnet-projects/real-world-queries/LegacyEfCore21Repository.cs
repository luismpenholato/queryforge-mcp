using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: EF Core 2.1 fixture project — no AsSplitQuery auto suggestion in version notes for split query rewrite
public class LegacyEfCore21Repository
{
    private readonly AppDbContext _context;

    public LegacyEfCore21Repository(AppDbContext context) => _context = context;

    public async Task<object> GetLegacyAsync()
    {
        return await _context.Orders
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .Where(x => x.Active)
            .ToListAsync();
    }
}
