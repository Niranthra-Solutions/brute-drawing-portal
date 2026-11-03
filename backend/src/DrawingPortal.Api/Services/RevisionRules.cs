using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace DrawingPortal.Api.Services;

/// <summary>
/// Revision rules shared by search, drawing detail and the modification-request check.
/// A "family" is a drawing number without its revision letter (25 600 028), taken across EVERY vehicle make and model:
/// the latest revision is the highest active letter anywhere in the family, and only that one may be modified.
/// </summary>
public static class RevisionRules
{
    /// <summary>"25 600 028 A" -> "25 600 028 " (number without its revision letter), or null when the number has no trailing letter.</summary>
    public static string? Prefix(string? number) => number is { Length: > 2 } && char.IsLetter(number[^1]) && number[^2] == ' ' ? number[..^1] : null;

    /// <summary>For each family prefix, the highest ACTIVE drawing number in the whole portal (every make / model).</summary>
    public static async Task<Dictionary<string, string>> LatestByPrefixAsync(AppDbContext db, IEnumerable<string?> numbers, CancellationToken ct)
    {
        var latest = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var g in numbers.Select(Prefix).Where(p => p is not null).Select(p => p!).Distinct().GroupBy(p => p.Length))
        {
            var pl = g.Key; var list = g.ToList();
            var nums = await db.Drawings.AsNoTracking()
                .Where(d => d.Status == DrawingStatus.Active && d.DrawingNumber.Length == pl + 1 && list.Contains(d.DrawingNumber.Substring(0, pl)))
                .Select(d => d.DrawingNumber).ToListAsync(ct);
            foreach (var n in nums)
            {
                var pre = n[..pl];
                if (!latest.TryGetValue(pre, out var cur) || string.CompareOrdinal(n, cur) > 0) latest[pre] = n;
            }
        }
        return latest;
    }

    public static bool IsLatest(Dictionary<string, string> latest, string number) =>
        Prefix(number) is not { } p || !latest.TryGetValue(p, out var top) || string.CompareOrdinal(number, top) >= 0;

    public static string? NewerThan(Dictionary<string, string> latest, string number) =>
        Prefix(number) is { } p && latest.TryGetValue(p, out var top) && string.CompareOrdinal(top, number) > 0 ? top : null;
}