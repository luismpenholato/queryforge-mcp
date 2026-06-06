public async Task<List<OrderSummaryDto>> GetOrdersByYearAsync(int currentYear)
{
    return await _context.Orders
        .Where(o =>
            o.OrderedAt.Year == currentYear &&
            new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }.Contains(o.OrderedAt.Month) &&
            o.TotalAmount.ToString()!.Contains('3'))
        .OrderByDescending(o => o.OrderedAt)
        .Take(30_000)
        .Select(o => new OrderSummaryDto
        {
            Id = o.Id,
            CustomerId = o.CustomerId,
            OrderedAt = o.OrderedAt,
            TotalAmount = o.TotalAmount
        })
        .ToListAsync();
}
