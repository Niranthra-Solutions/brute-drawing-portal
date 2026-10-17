namespace DrawingPortal.Api.Services;

/// <summary>Candidate row projected from the database for scoring.</summary>
public sealed record DrawingFacts(
    string Id, string DrawingNumber, string ModelId, string MakeId, int VoltageV, int AhValue, string AhStandard,
    int LengthMm, int WidthMm, int HeightMm);

public sealed record SearchCriteria(
    string? ModelId, string? MakeId, int VoltageV, int AhValue, string AhStandard, int LengthMm, int WidthMm, int HeightMm);

public sealed record Tolerance(int LengthMm, int WidthMm, int HeightMm);

public sealed record ScoredMatch(
    DrawingFacts Drawing, int DeltaLength, int DeltaWidth, int DeltaHeight,
    double Deviation, double FitPercent, bool SameModel, bool SameMake, bool SameAh);

/// <summary>
/// Pure, database-independent implementation of BRD §1.5 and §1.8 (unit-tested).
///  - Standard drawing: ALL inputs match (model, voltage, Ah rating incl. standard suffix, L, W, H).
///  - Non-standard: voltage equal AND each dimension within +/- tolerance (default 20 / 10 / 20 mm, inclusive).
///    Ah rating is NOT used as a filter (BRD: "include all available Ah ratings based on voltage and dimensions").
///  - Ranking: normalised deviation  |dL|/tolL + |dW|/tolW + |dH|/tolH  ascending (closest first), then
///    same model, same Ah, same make, then drawing number for a stable order.
/// </summary>
public static class SuggestionEngine
{
    public static bool IsExact(DrawingFacts d, SearchCriteria c) =>
        c.ModelId is not null && d.ModelId == c.ModelId && d.VoltageV == c.VoltageV &&
        d.AhValue == c.AhValue && string.Equals(d.AhStandard, c.AhStandard, StringComparison.OrdinalIgnoreCase) &&
        d.LengthMm == c.LengthMm && d.WidthMm == c.WidthMm && d.HeightMm == c.HeightMm;

    public static bool IsWithinTolerance(DrawingFacts d, SearchCriteria c, Tolerance t) =>
        d.VoltageV == c.VoltageV &&
        Math.Abs(d.LengthMm - c.LengthMm) <= t.LengthMm &&
        Math.Abs(d.WidthMm - c.WidthMm) <= t.WidthMm &&
        Math.Abs(d.HeightMm - c.HeightMm) <= t.HeightMm;

    public static ScoredMatch Score(DrawingFacts d, SearchCriteria c, Tolerance t)
    {
        int dl = d.LengthMm - c.LengthMm, dw = d.WidthMm - c.WidthMm, dh = d.HeightMm - c.HeightMm;
        double Part(int delta, int tol) => tol <= 0 ? (delta == 0 ? 0 : 1) : Math.Abs(delta) / (double)tol;
        var deviation = Part(dl, t.LengthMm) + Part(dw, t.WidthMm) + Part(dh, t.HeightMm);
        var fit = Math.Round(Math.Max(0, 1 - deviation / 3.0) * 100, 1);
        return new ScoredMatch(d, dl, dw, dh, deviation, fit,
            c.ModelId is not null && d.ModelId == c.ModelId,
            c.MakeId is not null && d.MakeId == c.MakeId,
            d.AhValue == c.AhValue && string.Equals(d.AhStandard, c.AhStandard, StringComparison.OrdinalIgnoreCase));
    }

    public static List<ScoredMatch> Rank(IEnumerable<DrawingFacts> candidates, SearchCriteria c, Tolerance t, int max) =>
        candidates.Where(d => IsWithinTolerance(d, c, t))
            .Select(d => Score(d, c, t))
            .OrderBy(s => s.Deviation)
            .ThenByDescending(s => s.SameModel)
            .ThenByDescending(s => s.SameAh)
            .ThenByDescending(s => s.SameMake)
            .ThenBy(s => s.Drawing.DrawingNumber, StringComparer.Ordinal)
            .Take(max).ToList();
}
