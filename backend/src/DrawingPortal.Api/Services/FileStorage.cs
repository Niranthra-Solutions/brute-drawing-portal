using System.Security.Cryptography;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Options;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Services;

public static class FileRules
{
    public sealed record Rule(string ContentType, bool Inline, Func<byte[], int, bool> Magic);

    private static bool Starts(byte[] b, int n, params byte[] sig) => n >= sig.Length && sig.AsSpan().SequenceEqual(b.AsSpan(0, sig.Length));
    private static bool Contains(byte[] b, int n, string s) => System.Text.Encoding.ASCII.GetString(b, 0, Math.Min(n, 1024)).Contains(s, StringComparison.Ordinal);

    public static readonly Dictionary<string, Rule> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = new("application/pdf", true, (b, n) => Contains(b, n, "%PDF-")),
        [".png"] = new("image/png", true, (b, n) => Starts(b, n, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)),
        [".jpg"] = new("image/jpeg", true, (b, n) => Starts(b, n, 0xFF, 0xD8, 0xFF)),
        [".jpeg"] = new("image/jpeg", true, (b, n) => Starts(b, n, 0xFF, 0xD8, 0xFF)),
        [".dwg"] = new("application/acad", false, (b, n) => n >= 6 && b[0] == 'A' && b[1] == 'C' && b[2] == '1' && b[3] is >= (byte)'0' and <= (byte)'9'),
        [".dxf"] = new("image/vnd.dxf", false, (b, n) => Contains(b, n, "SECTION") || Contains(b, n, "AutoCAD Binary DXF")),
        [".mp4"] = new("video/mp4", false, (b, n) => n >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p'),
        [".pptx"] = new("application/vnd.openxmlformats-officedocument.presentationml.presentation", false, (b, n) => Starts(b, n, 0x50, 0x4B, 0x03, 0x04)),
        [".docx"] = new("application/vnd.openxmlformats-officedocument.wordprocessingml.document", false, (b, n) => Starts(b, n, 0x50, 0x4B, 0x03, 0x04)),
        [".xlsx"] = new("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", false, (b, n) => Starts(b, n, 0x50, 0x4B, 0x03, 0x04)),
        [".ppt"] = new("application/vnd.ms-powerpoint", false, (b, n) => Starts(b, n, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)),
        [".doc"] = new("application/msword", false, (b, n) => Starts(b, n, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)),
        [".xls"] = new("application/vnd.ms-excel", false, (b, n) => Starts(b, n, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)),
    };

    public static readonly Dictionary<FileKind, string[]> Allowed = new()
    {
        [FileKind.Drawing] = [".dwg", ".dxf", ".pdf", ".png", ".jpg", ".jpeg"],
        [FileKind.RequestAttachment] = [".jpg", ".jpeg", ".png", ".pdf", ".dwg"],
        [FileKind.Document] = [".pdf", ".pptx", ".ppt", ".docx", ".doc", ".xlsx", ".xls", ".mp4", ".png", ".jpg", ".jpeg"],
    };

    public static string SafeDisplayName(string? name)
    {
        var n = Path.GetFileName((name ?? "file").Replace('\\', '/'));
        n = new string(n.Where(c => !char.IsControl(c) && c is not ('<' or '>' or '"' or '|' or '?' or '*' or ':')).ToArray()).Trim();
        return n.Length == 0 ? "file" : Text.Truncate(n, 200);
    }
}

public interface IFileStorage
{
    Task<StoredFile> SaveAsync(IFormFile file, FileKind kind, string? userId, CancellationToken ct);
    Task<StoredFile> SaveBytesAsync(byte[] bytes, string fileName, FileKind kind, string? userId, CancellationToken ct);
    FileStream Open(StoredFile file);
}

public sealed class FileStorage(AppDbContext db, IOptions<StorageOptions> opt, IWebHostEnvironment env) : IFileStorage
{
    private string Root => Path.GetFullPath(Path.IsPathRooted(opt.Value.RootPath) ? opt.Value.RootPath : Path.Combine(env.ContentRootPath, opt.Value.RootPath));

    private long MaxBytes(FileKind k) => 1024L * 1024 * k switch
    { FileKind.Drawing => opt.Value.MaxDrawingMb, FileKind.RequestAttachment => opt.Value.MaxAttachmentMb, _ => opt.Value.MaxDocumentMb };

    public async Task<StoredFile> SaveAsync(IFormFile file, FileKind kind, string? userId, CancellationToken ct)
    {
        await using var s = file.OpenReadStream();
        return await SaveStreamAsync(s, file.FileName, kind, userId, ct);
    }

    public async Task<StoredFile> SaveBytesAsync(byte[] bytes, string fileName, FileKind kind, string? userId, CancellationToken ct)
    {
        await using var ms = new MemoryStream(bytes, writable: false);
        return await SaveStreamAsync(ms, fileName, kind, userId, ct);
    }

    private async Task<StoredFile> SaveStreamAsync(Stream input, string clientName, FileKind kind, string? userId, CancellationToken ct)
    {
        var display = FileRules.SafeDisplayName(clientName);
        var ext = Path.GetExtension(display).ToLowerInvariant();
        if (!FileRules.Allowed[kind].Contains(ext))
            throw ApiException.BadRequest($"File type '{ext}' is not allowed. Allowed: {string.Join(", ", FileRules.Allowed[kind])}", "file");
        var rule = FileRules.Known[ext];

        var file = new StoredFile { Kind = kind, OriginalName = display, Extension = ext, ContentType = rule.ContentType, UploadedById = userId };
        var rel = Path.Combine(kind.ToString().ToLowerInvariant(), DateTime.UtcNow.ToString("yyyy"), DateTime.UtcNow.ToString("MM"), file.Id + ext);
        var full = Path.GetFullPath(Path.Combine(Root, rel));
        if (!full.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.Ordinal)) throw ApiException.BadRequest("Invalid path.");
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);

        var limit = MaxBytes(kind);
        var head = new byte[2048]; var headLen = 0; long total = 0; var firstChunk = true;
        using var sha = SHA256.Create();
        try
        {
            await using var outFs = new FileStream(full, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, FileOptions.Asynchronous);
            var buf = new byte[81920]; int read;
            while ((read = await input.ReadAsync(buf, ct)) > 0)
            {
                total += read;
                if (total > limit) throw ApiException.BadRequest($"File is larger than the {limit / 1024 / 1024} MB limit.", "file");
                if (firstChunk) { headLen = Math.Min(read, head.Length); Array.Copy(buf, head, headLen); firstChunk = false; if (!rule.Magic(head, headLen)) throw ApiException.BadRequest($"File content does not look like a valid {ext} file.", "file"); }
                sha.TransformBlock(buf, 0, read, null, 0);
                await outFs.WriteAsync(buf.AsMemory(0, read), ct);
            }
            if (total == 0) throw ApiException.BadRequest("File is empty.", "file");
            sha.TransformFinalBlock([], 0, 0);
        }
        catch { try { File.Delete(full); } catch { /* best effort */ } throw; }

        file.StoredPath = rel.Replace('\\', '/');
        file.SizeBytes = total;
        file.Sha256 = Convert.ToHexString(sha.Hash!).ToLowerInvariant();
        file.Url = "/api/files/" + file.Id;
        db.Files.Add(file);
        await db.SaveChangesAsync(ct);
        return file;
    }

    public FileStream Open(StoredFile f)
    {
        var full = Path.GetFullPath(Path.Combine(Root, f.StoredPath));
        if (!full.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !File.Exists(full))
            throw ApiException.NotFound("The file is no longer available on the server.");
        return new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
    }
}
