public async Task<List<ProductSummaryDto>> GetStoreProductsAsync(int storeId, int page)
{
    var products = await _context.Products.ToListAsync();

    return products
        .Where(p => p.StoreId == storeId)
        .OrderBy(p => p.Name)
        .Skip(page * 50)
        .Take(50)
        .Select(p => new ProductSummaryDto
        {
            Id = p.Id,
            Name = p.Name,
            CategoryName = p.Category.Name
        })
        .ToList();
}
