public async Task<List<OrderSummaryDto>> GetCustomerOrdersAsync(
    int customerId,
    string status,
    DateTime startDate,
    DateTime endDate)
{
    return await _context.Orders
        .AsNoTracking()
        .Where(o =>
            o.CustomerId == customerId &&
            o.Status == status &&
            o.OrderedAt >= startDate &&
            o.OrderedAt < endDate)
        .OrderByDescending(o => o.OrderedAt)
        .ThenBy(o => o.Id)
        .Select(o => new OrderSummaryDto
        {
            Id = o.Id,
            CustomerId = o.CustomerId,
            Status = o.Status,
            OrderedAt = o.OrderedAt,
            TotalAmount = o.TotalAmount
        })
        .Take(100)
        .ToListAsync();
}
