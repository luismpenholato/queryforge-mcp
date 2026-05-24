using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: CUSTOM_METHOD_IN_WHERE, canAutoFix=false, strict mode no optimized code
public class DynamicFiltersRepository
{
    private readonly AppDbContext _context;

    public DynamicFiltersRepository(AppDbContext context) => _context = context;

    public async Task<object> GetAsync(string name)
    {
        return await _context.Customers
            .Where(x => Normalizar(x.Name) == name)
            .ToListAsync();
    }

    private static string Normalizar(string value) => value.Trim().ToLowerInvariant();
}
