public async Task ProcessCustomerOrdersAsync(List<Customer> customers)
{
    foreach (var customer in customers)
    {
        var orders = await _context.Orders
            .Where(o => o.CustomerId == customer.Id)
            .ToListAsync();

        var invoices = await _context.Invoices
            .Where(i => i.CustomerId == customer.Id)
            .ToListAsync();
    }
}

public IQueryable<object> BuildCartesianReportQuery()
{
    return from customer in _context.Customers
           from order in _context.Orders
           from product in _context.Products
           select new
           {
               customer.Id,
               order.Id,
               product.Name
           };
}

public async Task<List<CustomerSummaryDto>> GetCustomerSummariesAsync()
{
    return await _context.Customers
        .Select(c => new CustomerSummaryDto
        {
            Id = c.Id,
            OrderCount = _context.Orders.Count(o => o.CustomerId == c.Id),
            AverageAmount = _context.Orders.Average(o => o.CustomerId == c.Id ? o.TotalAmount : 0)
        })
        .ToListAsync();
}

public async Task<List<Customer>> GetLegacyCustomersAsync()
{
    return await _context.Customers
        .Where(c =>
            c.IsActive &&
            c.LegacyCode == c.Id.ToString() &&
            c.LegacyCode == c.Id.ToString())
        .ToListAsync();
}

public async Task<List<LogEntry>> GetRecentLogEntriesAsync(DateTime startDate)
{
    return await _context.LogEntries
        .Where(l => l.CreatedAt >= startDate)
        .OrderByDescending(l => l.CreatedAt)
        .Take(40_000)
        .ToListAsync();
}
