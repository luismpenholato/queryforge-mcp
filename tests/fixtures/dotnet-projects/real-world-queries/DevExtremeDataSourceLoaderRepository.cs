using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: early materialization pattern similar to DevExtreme loader usage
public class DevExtremeDataSourceLoaderRepository
{
    private readonly AppDbContext _context;

    public DevExtremeDataSourceLoaderRepository(AppDbContext context) => _context = context;

    public async Task<object> LoadAsync()
    {
        var data = await _context.Orders.Where(x => x.Active).ToListAsync();
        return data.Select(x => new { x.Id, x.CustomerId });
    }
}
