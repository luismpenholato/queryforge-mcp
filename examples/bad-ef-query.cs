public async Task<List<ProductSummaryDto>> GetActiveProductsAsync()
{
    var products = await _context.Products
        .Include(x => x.Category)
        .Where(x => x.IsActive)
        .ToListAsync();

    return products
        .Select(x => new ProductSummaryDto
        {
            Id = x.Id,
            Name = x.Name,
            CategoryName = x.Category.Name
        })
        .ToList();
}
