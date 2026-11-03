using System.Linq.Expressions;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;

namespace DrawingPortal.Api.Services;

public static class DrawingMapper
{
    /// <summary>Single SQL projection (joins model/make/type/category/connector/file) - no N+1, no tracking.</summary>
    public static readonly Expression<Func<Drawing, DrawingRow>> Row = d => new DrawingRow(
        d.Id, d.DrawingNumber, d.Model!.Make!.Name, d.Model.MakeId, d.Model.VehicleType!.Name, d.Model.Category!.Name,
        d.Model.ModelName, d.ModelId, d.Model.Capacity, d.VoltageV, d.AhValue, d.AhStandard, d.Connector!.Name, d.ConnectorTypeId,
        d.LengthMm, d.WidthMm, d.HeightMm, d.Comments, d.CompetitorDrawingNumber, d.Status, d.CurrentRevisionNo, d.CurrentFileId,
        d.CurrentFile == null ? null : d.CurrentFile.OriginalName, d.UpdatedAtUtc, d.Serial, d.AfsDrain);

    public static bool IsPreviewable(string? fileName)
    {
        var ext = Path.GetExtension(fileName ?? "").ToLowerInvariant();
        return ext is ".pdf" or ".png" or ".jpg" or ".jpeg" or ".mp4" or ".mov" or ".m4v" or ".webm";
    }

    /// <summary>Normalises a comma separated AFS / drain selection to canonical codes (AFS, Middle, Corner) in a fixed order.</summary>
    public static string? NormalizeAfs(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return null;
        var set = v.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(x => x.ToUpperInvariant()).ToHashSet();
        var list = new[] { "AFS", "Middle", "Corner" }.Where(c => set.Contains(c.ToUpperInvariant())).ToList();
        return list.Count == 0 ? null : string.Join(",", list);
    }

    /// <summary>The comment shown beside a drawing in search results when it has AFS / drain holes.</summary>
    public static string? AfsText(string? v)
    {
        var n = NormalizeAfs(v);
        if (n is null) return null;
        var parts = n.Split(',').Select(c => c switch { "AFS" => "AFS Available", "Middle" => "Middle Drain Holes Available", _ => "Corner Drain Holes Available" });
        return string.Join(", ", parts);
    }

    public static string AhLabel(int v, string std) => string.IsNullOrEmpty(std) ? v.ToString() : $"{v}({std})";

    public static DrawingDto ToDto(DrawingRow r) => new(
        r.Id, r.DrawingNumber, r.Make, r.MakeId, r.VehicleType, r.Category, r.Model, r.ModelId, r.Capacity, r.VoltageV,
        AhLabel(r.AhValue, r.AhStandard), r.AhValue, r.AhStandard, r.Connector, r.ConnectorId, r.LengthMm, r.WidthMm, r.HeightMm,
        r.Comments, r.CompetitorDrawingNumber, r.Status.ToString(), Text.RevisionLabel(r.RevisionNo), r.FileId, r.FileName, IsPreviewable(r.FileName), r.UpdatedAtUtc, r.Serial, true, r.AfsDrain, AfsText(r.AfsDrain));
}