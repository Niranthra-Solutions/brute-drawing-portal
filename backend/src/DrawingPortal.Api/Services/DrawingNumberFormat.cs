using System.Text;
using System.Text.RegularExpressions;

namespace DrawingPortal.Api.Services;

/// <summary>
/// Admin-configurable drawing number format expressed as a MASK, not a raw regex (a raw admin-supplied regex
/// would be a ReDoS risk). Tokens: '#' = digit, 'A' = letter, 'X' = letter or digit.
/// Literal characters allowed: space - / . _
/// Default mask "## ### ### A" accepts "25 600 001 A".
/// </summary>
public sealed class DrawingNumberFormat
{
    public const string DefaultMask = "## ### ### A";
    private static readonly char[] AllowedLiterals = [' ', '-', '/', '.', '_'];

    public string Mask { get; }
    public string Example { get; }
    private readonly Regex _regex;

    private DrawingNumberFormat(string mask, Regex regex, string example) { Mask = mask; _regex = regex; Example = example; }

    public static bool TryParse(string? mask, out DrawingNumberFormat? format, out string? error)
    {
        format = null; error = null;
        mask = mask?.Trim() ?? "";
        if (mask.Length is < 3 or > 40) { error = "Mask must be 3 to 40 characters."; return false; }
        var pattern = new StringBuilder("^");
        var example = new StringBuilder();
        var tokens = 0;
        foreach (var c in mask)
        {
            switch (c)
            {
                case '#': pattern.Append("[0-9]"); example.Append('1'); tokens++; break;
                case 'A': pattern.Append("[A-Z]"); example.Append('A'); tokens++; break;
                case 'X': pattern.Append("[A-Z0-9]"); example.Append('X'); tokens++; break;
                default:
                    if (!AllowedLiterals.Contains(c)) { error = $"Character '{c}' is not allowed. Use # (digit), A (letter), X (letter or digit), and space - / . _ as separators."; return false; }
                    pattern.Append(Regex.Escape(c.ToString())); example.Append(c); break;
            }
        }
        if (tokens == 0) { error = "Mask must contain at least one # , A or X."; return false; }
        pattern.Append('$');
        format = new DrawingNumberFormat(mask, new Regex(pattern.ToString(), RegexOptions.Compiled | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(50)), example.ToString());
        return true;
    }

    public static DrawingNumberFormat Default { get; } = TryParse(DefaultMask, out var f, out _) ? f! : throw new InvalidOperationException();

    /// <summary>Trim, collapse repeated whitespace and upper-case so "25  600 001 a" becomes "25 600 001 A".</summary>
    public static string Normalize(string? value) =>
        Regex.Replace((value ?? "").Trim(), @"\s+", " ").ToUpperInvariant();

    public bool IsMatch(string? value) => !string.IsNullOrEmpty(value) && _regex.IsMatch(Normalize(value));
}
