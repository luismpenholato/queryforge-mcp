using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: MULTIPLE_COLLECTION_INCLUDES, canAutoFix=false, manual review, AsSplitQuery mention on EF6
public class MultipleIncludesRepository
{
    private readonly AppDbContext _context;

    public MultipleIncludesRepository(AppDbContext context) => _context = context;

    public async Task<object> GetAsync()
    {
        return await _context.Orders
            .Include(x => x.Items)
            .Include(x => x.Payments)
            .Include(x => x.Anexos)
            .ToListAsync();
    }
}

public partial class Order
{
    public List<OrderAnexo> Anexos { get; set; } = new();
}

public class OrderAnexo
{
    public int Id { get; set; }
}
