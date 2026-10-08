using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DrawingPortal.Api.Services;

public sealed record DrawingSettings(string NumberMask, int ToleranceLengthMm, int ToleranceWidthMm, int ToleranceHeightMm)
{
    public static DrawingSettings Defaults => new(DrawingNumberFormat.DefaultMask, 20, 10, 20);
    public DrawingNumberFormat Format => DrawingNumberFormat.TryParse(NumberMask, out var f, out _) ? f! : DrawingNumberFormat.Default;
}

public interface ISettingsService
{
    Task<DrawingSettings> GetAsync(CancellationToken ct = default);
    Task<DrawingSettings> UpdateAsync(string mask, int tolL, int tolW, int tolH, CancellationToken ct = default);
}

public sealed class SettingsService(AppDbContext db, IMemoryCache cache, IAuditService audit, ICurrentUser user, ICacheVersion versions) : ISettingsService
{
    private const string CacheKey = "settings:drawing";
    private const string KMask = "drawing.numberMask", KL = "tol.length", KW = "tol.width", KH = "tol.height";

    public async Task<DrawingSettings> GetAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out DrawingSettings? hit) && hit is not null) return hit;
        var rows = await db.Settings.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        var d = DrawingSettings.Defaults;
        int I(string k, int def) => rows.TryGetValue(k, out var v) && int.TryParse(v, out var n) ? n : def;
        var result = new DrawingSettings(rows.GetValueOrDefault(KMask) ?? d.NumberMask, I(KL, d.ToleranceLengthMm), I(KW, d.ToleranceWidthMm), I(KH, d.ToleranceHeightMm));
        cache.Set(CacheKey, result, TimeSpan.FromMinutes(30));
        return result;
    }

    public async Task<DrawingSettings> UpdateAsync(string mask, int tolL, int tolW, int tolH, CancellationToken ct = default)
    {
        var errors = new FieldErrors();
        if (!DrawingNumberFormat.TryParse(mask, out var fmt, out var err)) errors.Add("numberMask", err!);
        foreach (var (name, v) in new[] { ("toleranceLengthMm", tolL), ("toleranceWidthMm", tolW), ("toleranceHeightMm", tolH) })
            if (v is < 0 or > 500) errors.Add(name, "Tolerance must be between 0 and 500 mm.");
        errors.ThrowIfAny();

        var before = await GetAsync(ct);
        var now = DateTime.UtcNow;
        async Task Upsert(string k, string v)
        {
            var row = await db.Settings.FindAsync([k], ct);
            if (row is null) db.Settings.Add(new AppSetting { Key = k, Value = v, UpdatedAtUtc = now, UpdatedBy = user.Email });
            else { row.Value = v; row.UpdatedAtUtc = now; row.UpdatedBy = user.Email; }
        }
        await Upsert(KMask, fmt!.Mask); await Upsert(KL, tolL.ToString()); await Upsert(KW, tolW.ToString()); await Upsert(KH, tolH.ToString());
        audit.Add("SettingsChanged", "Settings", null, "Drawing settings updated",
            new { before, after = new { mask = fmt.Mask, tolL, tolW, tolH } });
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
        versions.Bump();
        return await GetAsync(ct);
    }
}

/// <summary>Monotonic version used to invalidate the lookup bootstrap payload (and ETag) when master data/settings change.</summary>
public interface ICacheVersion { long Current { get; } void Bump(); }
public sealed class CacheVersion : ICacheVersion
{
    private long _v = 1;
    public long Current => Interlocked.Read(ref _v);
    public void Bump() => Interlocked.Increment(ref _v);
}
