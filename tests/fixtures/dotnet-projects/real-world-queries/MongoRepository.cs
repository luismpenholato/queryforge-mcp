using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: used with MongoDB provider fixture — no relational SQL/Dapper/index suggestions
public class MongoRepository
{
    private readonly AppDbContext _context;

    public MongoRepository(AppDbContext context) => _context = context;

    public async Task<object> GetAsync()
    {
        return await _context.Orders
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .ToListAsync();
    }
}
