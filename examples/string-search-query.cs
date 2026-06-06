public async Task<List<Product>> SearchCatalogProductsAsync(string search, string skuFragment)
{
    return await _context.Products
        .Where(p => p.Name.ToLower().Contains(search.ToLower()))
        .Where(p => p.Sku.Trim() == skuFragment.Trim())
        .Where(p => p.Category.Name.ToUpper().Contains(search.ToUpper()))
        .Where(p => p.Price.ToString().Contains("99"))
        .ToListAsync();
}
