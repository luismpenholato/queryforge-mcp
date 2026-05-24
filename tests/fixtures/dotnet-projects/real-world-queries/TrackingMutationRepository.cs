using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace RealWorld.Fixtures;

// Expect: no MISSING_AS_NO_TRACKING auto-fix when SaveChanges is present
public class TrackingMutationRepository
{
    private readonly AppDbContext _context;

    public TrackingMutationRepository(AppDbContext context) => _context = context;

    public async Task UpdateCustomerNameAsync(int id, string name)
    {
        var customer = await _context.Customers.FirstAsync(x => x.Id == id);
        customer.Name = name;
        await _context.SaveChangesAsync();
    }
}
