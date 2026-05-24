using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: LARGE_CONTAINS_RISK, canAutoFix=false, needsManualReview=true, no auto rewrite
public class LargeContainsRepository
{
    private readonly AppDbContext _context;

    public LargeContainsRepository(AppDbContext context) => _context = context;

    public async Task<List<Order>> GetByIdsAsync(List<int> orderIds)
    {
        return await _context.Orders
            .Where(x => orderIds.Contains(x.Id))
            .ToListAsync();
    }
}
