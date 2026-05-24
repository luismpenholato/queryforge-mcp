using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: read-only Dapper candidate on relational provider when EF risk is high
public class DapperReadOnlyRepository
{
    private readonly AppDbContext _context;

    public DapperReadOnlyRepository(AppDbContext context) => _context = context;

    public async Task<bool> HasOrdersAsync()
    {
        if (await _context.Orders.CountAsync() > 0)
            return true;
        return false;
    }
}
