using System.Security.Claims;
using System.Text.RegularExpressions;

namespace DrawingPortal.Api.Common;

public class ApiException : Exception
{
    public int Status { get; }
    public Dictionary<string, string[]>? Errors { get; }
    public ApiException(int status, string message, Dictionary<string, string[]>? errors = null) : base(message)
    { Status = status; Errors = errors; }

    public static ApiException BadRequest(string msg, string? field = null) =>
        new(400, msg, field is null ? null : new() { [field] = [msg] });
    public static ApiException NotFound(string msg = "Resource not found.") => new(404, msg);
    public static ApiException Forbidden(string msg = "You do not have permission to perform this action.") => new(403, msg);
    public static ApiException Conflict(string msg) => new(409, msg);
    public static ApiException Validation(Dictionary<string, string[]> errors) => new(422, "One or more validation errors occurred.", errors);
}

public sealed class FieldErrors
{
    private readonly Dictionary<string, List<string>> _e = new();
    public FieldErrors Add(string field, string message) { (_e.TryGetValue(field, out var l) ? l : _e[field] = new()).Add(message); return this; }
    public bool Any => _e.Count > 0;
    public void ThrowIfAny() { if (Any) throw ApiException.Validation(_e.ToDictionary(k => k.Key, v => v.Value.ToArray())); }
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public static class PagingExtensions
{
    public static (int page, int size) Normalize(int page, int size, int max = 100) =>
        (Math.Max(1, page), Math.Clamp(size <= 0 ? 25 : size, 1, max));
}

public interface ICurrentUser
{
    string? Id { get; }
    string? Email { get; }
    string? Name { get; }
    bool IsAdmin { get; }
    bool IsAuthenticated { get; }
    string? Ip { get; }
}

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? P => accessor.HttpContext?.User;
    public string? Id => P?.FindFirstValue("sub");
    public string? Email => P?.FindFirstValue("email");
    public string? Name => P?.FindFirstValue("name");
    public bool IsAdmin => P?.IsInRole("Admin") ?? false;
    public bool IsAuthenticated => P?.Identity?.IsAuthenticated ?? false;
    public string? Ip => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}

public static class Text
{
    private static readonly Regex Ws = new(@"\s+", RegexOptions.Compiled);
    public static string Clean(string? s, int max = 4000) => Truncate(Ws.Replace((s ?? "").Trim(), " "), max);
    public static string CleanMultiline(string? s, int max = 4000) => Truncate((s ?? "").Replace("\r\n", "\n").Trim(), max);
    public static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
    public static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>Neutralises spreadsheet formula injection for CSV/XLSX exports.</summary>
    public static string SafeCell(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s[0] is '=' or '+' or '-' or '@' or '\t' or '\r' ? "'" + s : s;
    }

    /// <summary>Converts 1 -> A, 2 -> B ... 27 -> AA</summary>
    public static string RevisionLabel(int n)
    {
        if (n <= 0) return "0";
        var s = "";
        while (n > 0) { n--; s = (char)('A' + n % 26) + s; n /= 26; }
        return s;
    }
}
