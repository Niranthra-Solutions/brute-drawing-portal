using System.Security.Cryptography;
using System.Text.Json;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DrawingPortal.Api.Services;

public sealed record CachedBootstrap(byte[] Json, string ETag);

public interface ILookupService { Task<CachedBootstrap> GetBootstrapAsync(CancellationToken ct); }

/// <summary>
/// One cached, ETag'd payload with every dropdown the UI needs (a few KB). The SPA performs the Category > Make > Type > Model > Capacity
/// cascade client-side, so there are no per-dropdown round trips. Cached in-process (IMemoryCache) and invalidated on any master-data change.
/// </summary>
public sealed class LookupService(AppDbContext db, ISettingsService settings, IMemoryCache cache, ICacheVersion version) : ILookupService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<CachedBootstrap> GetBootstrapAsync(CancellationToken ct)
    {
        var key = "bootstrap:" + version.Current;
        if (cache.TryGetValue(key, out CachedBootstrap? hit) && hit is not null) return hit;

        var cats = await db.Categories.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new NamedItemDto(x.Id, x.Name, x.SortOrder, x.IsActive)).ToListAsync(ct);
        var types = await db.VehicleTypes.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new NamedItemDto(x.Id, x.Name, x.SortOrder, x.IsActive)).ToListAsync(ct);
        var makes = await db.Makes.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new NamedItemDto(x.Id, x.Name, x.SortOrder, x.IsActive)).ToListAsync(ct);
        var cons = await db.Connectors.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new NamedItemDto(x.Id, x.Name, x.SortOrder, x.IsActive)).ToListAsync(ct);
        var models = await db.Models.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.ModelName).ThenBy(x => x.Capacity).Select(x => new ModelDto(x.Id, x.MakeId, x.VehicleTypeId, x.CategoryId, x.ModelName, x.Capacity, x.IsActive)).ToListAsync(ct);
        var volts = await db.Voltages.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.ValueV).Select(x => new VoltageDto(x.Id, x.ValueV, x.IsActive)).ToListAsync(ct);
        var ahs = (await db.AhRatings.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Value).ThenBy(x => x.Standard).ToListAsync(ct))
            .Select(x => new AhDto(x.Id, x.Value, x.Standard, x.Label, x.IsActive)).ToList();
        var s = await settings.GetAsync(ct);
        var dto = new BootstrapDto(cats, types, makes, cons, models, volts, ahs, s.Format.Mask, s.Format.Example, new ToleranceDto(s.ToleranceLengthMm, s.ToleranceWidthMm, s.ToleranceHeightMm));
        var bytes = JsonSerializer.SerializeToUtf8Bytes(dto, Json);
        var result = new CachedBootstrap(bytes, "\"" + Convert.ToHexString(SHA1.HashData(bytes))[..16].ToLowerInvariant() + "\"");
        cache.Set(key, result, TimeSpan.FromHours(6));
        return result;
    }
}
