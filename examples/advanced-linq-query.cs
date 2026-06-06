public async Task<List<OrderSummaryDto>> GetFilteredOrdersAsync(int currentYear, string search)
{
    return await _context.Orders
        .Include(o => o.Customer)
        .Where(o => o.OrderedAt.Year == currentYear)
        .Where(o => new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }.Contains(o.OrderedAt.Month))
        .Where(o => o.TotalAmount.ToString().Contains("3"))
        .Where(o => o.Customer.Name.ToLower().Contains(search.ToLower()))
        .OrderByDescending(o => o.OrderedAt)
        .Take(30_000)
        .Select(o => new OrderSummaryDto
        {
            Id = o.Id,
            CustomerName = o.Customer.Name,
            OrderedAt = o.OrderedAt,
            TotalAmount = o.TotalAmount
        })
        .ToListAsync();
}
