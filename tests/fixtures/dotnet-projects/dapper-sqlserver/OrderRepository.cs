using Dapper;

public class OrderRepository
{
    public async Task<IEnumerable<OrderDto>> GetOrdersAsync(int customerId)
    {
        const string sql = "SELECT Id, Total FROM Orders WHERE CustomerId = @CustomerId";
        return await connection.QueryAsync<OrderDto>(sql, new { CustomerId = customerId });
    }
}
