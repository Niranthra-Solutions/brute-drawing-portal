using System.Security.Cryptography;

namespace DrawingPortal.Api.Common;

/// <summary>
/// Prefixed NanoID generator, e.g. "drw_k3x9a0b7q2m1z8c4v6n5t".
/// Uses a lowercase alphanumeric alphabet so IDs stay unique under case-insensitive SQL Server collations,
/// and a cryptographically secure RNG with rejection sampling (no modulo bias).
/// </summary>
public static class NanoId
{
    private const string Alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    public const int DefaultSize = 21;

    public static string New(string prefix, int size = DefaultSize)
    {
        Span<char> body = stackalloc char[size];
        Span<byte> buf = stackalloc byte[size * 2];
        int filled = 0;
        while (filled < size)
        {
            RandomNumberGenerator.Fill(buf);
            foreach (var b in buf)
            {
                var idx = b & 63;                       // 36 symbols -> 6-bit mask, reject >= 36
                if (idx < Alphabet.Length) { body[filled++] = Alphabet[idx]; if (filled == size) break; }
            }
        }
        return string.Concat(prefix, "_", new string(body));
    }
}

/// <summary>ID prefixes per entity type.</summary>
public static class Ids
{
    public const string User = "usr", Category = "cat", VehicleType = "vty", Make = "mak", Model = "mdl",
        Connector = "con", Voltage = "vlt", Ah = "ahr", Drawing = "drw", Revision = "rev", File = "fil",
        Request = "req", RequestEvent = "evt", Comment = "cmt", Notification = "ntf", Email = "eml",
        Audit = "aud", Document = "doc", Otp = "otp", Refresh = "rtk", Job = "job", JobError = "jer", Attachment = "att", ModelBattery = "mbt";
}
