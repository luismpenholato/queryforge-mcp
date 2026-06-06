public async Task<List<OrderDetailDto>> GetActiveOrderDetailsAsync()
{
    return await _context.Orders
        .Include(o => o.Customer)
        .Include(o => o.Invoice)
        .ThenInclude(i => i.Review)
        .Where(o => o.IsActive)
        .Select(o => new OrderDetailDto
        {
            Id = o.Id,
            CustomerName = o.Customer.Name,
            InvoiceTotal = o.Invoice.TotalAmount,
            ReviewScore = o.Invoice.Review.Score
        })
        .ToListAsync();
}
