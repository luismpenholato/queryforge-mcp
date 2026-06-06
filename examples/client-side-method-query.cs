public async Task<List<Customer>> GetMatchingCustomersAsync(string searchName)
{
    return await _context.Customers
        .Where(c => IsValidEmail(c.Email))
        .Where(c => Normalize(c.Name) == searchName)
        .Where(c => StoreHelper.MatchesRegion(c.StoreId, regionCode))
        .ToListAsync();
}
