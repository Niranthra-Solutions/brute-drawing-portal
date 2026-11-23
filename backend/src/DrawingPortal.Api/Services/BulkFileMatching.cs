using System.Text.RegularExpressions;

namespace DrawingPortal.Api.Services;

/// <summary>What the file name of an uploaded drawing says: "25 600 002 B(48V-775 AH).pdf" is drawing 25 600 002 B, 48 V, 775 Ah.</summary>
public sealed record ParsedDrawingFileName(string Number, int? VoltageV, int? Ah, string Standard);

public static class DrawingFileName
{
    // <number> [ ( <volts>V - <ah> [AH|DIN|BS...] ) ] [ (1) ]   - the "(1)" is what Windows adds to a copied file
    private static readonly Regex Pattern = new(
        @"^\s*(?<num>[^()]*?)\s*(?:\(\s*(?<v>\d{1,4})\s*V\s*[-–—_ ]\s*(?<ah>\d{1,6})\s*(?<std>[A-Za-z]{0,10})\s*\)\s*)?(?:\(\s*\d+\s*\)\s*)?$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));

    public static ParsedDrawingFileName? Parse(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return null;
        var m = Pattern.Match(Path.GetFileNameWithoutExtension(fileName.Trim()));
        if (!m.Success) return null;
        var num = DrawingNumberFormat.Normalize(m.Groups["num"].Value);
        if (num.Length == 0) return null;
        int? v = m.Groups["v"].Success ? int.Parse(m.Groups["v"].Value) : null;
        int? ah = m.Groups["ah"].Success ? int.Parse(m.Groups["ah"].Value) : null;
        var std = m.Groups["std"].Value.Trim().ToUpperInvariant();
        if (std == "AH") std = "";
        return new ParsedDrawingFileName(num, v, ah, std);
    }

    /// <summary>The name the admin should give a missing file, in the format the portal expects.</summary>
    public static string Expected(string number, int? volt, int? ah, string? std)
    {
        if (volt is null || ah is null) return number + ".pdf";
        return $"{number}({volt}V-{ah} {(string.IsNullOrWhiteSpace(std) ? "AH" : std.ToUpperInvariant())}).pdf";
    }
}

/// <summary>Drawing files already uploaded, looked up by the drawing number / voltage / Ah in their file names (newest upload wins).</summary>
public sealed class DrawingFileIndex
{
    public sealed record Entry(string Id, string Name, ParsedDrawingFileName Parsed, DateTime CreatedAtUtc);
    private readonly Dictionary<string, Entry> _exact = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Entry> _byNumber = new(StringComparer.OrdinalIgnoreCase);
    public List<Entry> All { get; } = [];

    public static DrawingFileIndex Build(IEnumerable<(string Id, string Name, DateTime CreatedAtUtc)> files)
    {
        var ix = new DrawingFileIndex();
        foreach (var (id, name, created) in files.OrderBy(f => f.CreatedAtUtc))   // later uploads overwrite earlier ones
        {
            var p = DrawingFileName.Parse(name);
            if (p is null) continue;
            var e = new Entry(id, name, p, created);
            ix.All.Add(e);
            if (p.VoltageV is not null && p.Ah is not null) ix._exact[$"{p.Number}|{p.VoltageV}|{p.Ah}"] = e;
            else ix._byNumber[p.Number] = e;
        }
        return ix;
    }

    /// <summary>The file for this drawing: the exact "number + volts + Ah" file, otherwise a file named with only the number.</summary>
    public Entry? Find(string number, int? volt, int? ah)
    {
        number = DrawingNumberFormat.Normalize(number);
        if (volt is not null && ah is not null && _exact.TryGetValue($"{number}|{volt}|{ah}", out var e)) return e;
        return _byNumber.TryGetValue(number, out e) ? e : null;
    }
}