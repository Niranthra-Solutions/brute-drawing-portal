using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace DrawingPortal.Api.Data;

/// <summary>Used only by "dotnet ef" so migrations can be generated without starting the web host or touching a database.</summary>
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=.;Database=DrawingPortal;Trusted_Connection=True;TrustServerCertificate=True").Options);
}
