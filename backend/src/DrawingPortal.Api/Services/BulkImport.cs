using System.Text.RegularExpressions;
using System.Threading.Channels;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using DrawingPortal.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MiniExcelLibs;

namespace DrawingPortal.Api.Services;

public sealed class BulkImportQueue
{
    private readonly Channel<string> _ch = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
    public void Enqueue(string jobId) => _ch.Writer.TryWrite(jobId);
    public IAsyncEnumerable<string> ReadAllAsync(CancellationToken ct) => _ch.Reader.ReadAllAsync(ct);
}

public interface IBulkImportService
{
    Task<BulkJobDto> StartAsync(IFormFile file, bool skipDuplicates, bool autoCreateMaster, CancellationToken ct);
    Task ProcessAsync(string jobId, CancellationToken ct);
    Task<IReadOnlyList<BulkJobDto>> ListAsync(CancellationToken ct);
    Task<BulkJobDto> GetAsync(string id, CancellationToken ct);
    Task<IReadOnlyList<BulkErrorDto>> ErrorsAsync(string id, CancellationToken ct);
    byte[] BuildTemplate();
}

/// <summary>
/// Admin uploads an .xlsx; each row describes one drawing and carries the URL that the "Upload drawing" screen generated for its file.
/// Processing runs on a dedicated background worker (one job at a time): the sheet is STREAMED (never fully loaded), rows are validated in memory
/// against pre-loaded master data, and inserted in batches with a short pause between batches so interactive traffic is never starved.
/// </summary>
public sealed class BulkImportService(AppDbContext db, ISettingsService settings, INotifier notifier, IAuditService audit, ICurrentUser me,
    BulkImportQueue queue, ICacheVersion versions, IOptions<BulkOptions> bulk, IOptions<StorageOptions> storage, IWebHostEnvironment env, ILogger<BulkImportService> log) : IBulkImportService
{
    private static readonly Regex FileIdInUrl = new(@"/files/(fil_[a-z0-9]{21})(?:[/?#]|$)", RegexOptions.Compiled | RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(100));
    private static readonly Regex AhPattern = new(@"^\s*(\d{1,6})\s*(?:\(\s*([A-Za-z0-9 ]{1,20})\s*\))?\s*$", RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));
    private string TempDir => Path.Combine(Path.GetDirectoryName(Path.GetFullPath(Path.IsPathRooted(storage.Value.RootPath) ? storage.Value.RootPath : Path.Combine(env.ContentRootPath, storage.Value.RootPath)))!, "bulk");

    private static BulkJobDto ToDto(BulkImportJob j) => new(j.Id, j.Status.ToString(), j.OriginalFileName, j.TotalRows, j.ProcessedRows, j.CreatedCount, j.SkippedCount, j.ErrorCount, j.FailureMessage, j.SkipDuplicates, j.AutoCreateMaster, j.CreatedAtUtc, j.StartedAtUtc, j.FinishedAtUtc);

    // ------------------------------------------------------------------ start
    public async Task<BulkJobDto> StartAsync(IFormFile file, bool skipDuplicates, bool autoCreateMaster, CancellationToken ct)
    {
        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase)) throw ApiException.BadRequest("Upload an Excel .xlsx file.", "file");
        if (file.Length == 0 || file.Length > bulk.Value.MaxFileMb * 1024L * 1024) throw ApiException.BadRequest($"The Excel file must be between 1 byte and {bulk.Value.MaxFileMb} MB.", "file");
        if (await db.BulkJobs.AnyAsync(j => j.Status == JobStatus.Queued || j.Status == JobStatus.Running, ct)) throw ApiException.Conflict("Another bulk import is still running. Please wait for it to finish.");
        var job = new BulkImportJob { OriginalFileName = FileRules.SafeDisplayName(file.FileName), RequestedById = me.Id!, SkipDuplicates = skipDuplicates, AutoCreateMaster = autoCreateMaster };
        Directory.CreateDirectory(TempDir);
        var path = Path.Combine(TempDir, job.Id + ".xlsx");
        await using (var fs = File.Create(path)) { await using var s = file.OpenReadStream(); await s.CopyToAsync(fs, ct); }
        using (var fs = File.OpenRead(path)) { var sig = new byte[4]; _ = fs.Read(sig, 0, 4); if (sig[0] != 0x50 || sig[1] != 0x4B) { fs.Close(); File.Delete(path); throw ApiException.BadRequest("This is not a valid .xlsx file.", "file"); } }
        job.TempPath = path;
        db.BulkJobs.Add(job);
        audit.Add("BulkImportStarted", "BulkImport", job.Id, $"Bulk import '{job.OriginalFileName}' queued");
        await db.SaveChangesAsync(ct);
        queue.Enqueue(job.Id);
        return ToDto(job);
    }

    public async Task<IReadOnlyList<BulkJobDto>> ListAsync(CancellationToken ct) =>
        (await db.BulkJobs.AsNoTracking().OrderByDescending(j => j.CreatedAtUtc).Take(20).ToListAsync(ct)).Select(ToDto).ToList();
    public async Task<BulkJobDto> GetAsync(string id, CancellationToken ct) =>
        ToDto(await db.BulkJobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id, ct) ?? throw ApiException.NotFound("Import job not found."));
    public async Task<IReadOnlyList<BulkErrorDto>> ErrorsAsync(string id, CancellationToken ct) =>
        await db.BulkErrors.AsNoTracking().Where(e => e.JobId == id).OrderBy(e => e.RowNumber).Take(5000).Select(e => new BulkErrorDto(e.RowNumber, e.DrawingNumber, e.Message)).ToListAsync(ct);

    // ------------------------------------------------------------------ template
    public byte[] BuildTemplate()
    {
        var sample = new List<Dictionary<string, object?>>
        {
            new() { ["DrawingNumber"] = "25 600 001 A", ["Category"] = "Imports", ["Make"] = "Jungheinrich", ["VehicleType"] = "Reach Truck", ["Model"] = "ETV 320", ["Capacity"] = "1.8 T", ["Voltage"] = 48, ["AhRating"] = "620(DIN)", ["Connector"] = "SR 350A", ["Length"] = 1220, ["Width"] = 350, ["Height"] = 780, ["Comments"] = "", ["CompetitorDrawingNumber"] = "", ["DrawingUrl"] = "https://your-portal/api/files/fil_xxxxxxxxxxxxxxxxxxxxx" },
        };
        var help = new List<Dictionary<string, object?>>
        {
            new() { ["Column"] = "DrawingNumber", ["Rule"] = "Must match the drawing number format configured by the admin (default ## ### ### A)." },
            new() { ["Column"] = "Category / Make / VehicleType / Model / Capacity / Connector", ["Rule"] = "Must exist in master data, unless 'Create missing master data' is ticked on the import screen." },
            new() { ["Column"] = "Voltage", ["Rule"] = "Number in volts, for example 48." },
            new() { ["Column"] = "AhRating", ["Rule"] = "Number, optionally followed by a standard in brackets: 560 or 620(DIN)." },
            new() { ["Column"] = "Length / Width / Height", ["Rule"] = "Tray dimensions in mm, 3 or 4 digits." },
            new() { ["Column"] = "DrawingUrl", ["Rule"] = "The URL shown after uploading the file on the 'Upload drawing' screen. Required. The same URL may be used on several rows when one drawing file covers several drawings." },
        };
        using var ms = new MemoryStream();
        MiniExcel.SaveAs(ms, new Dictionary<string, object> { ["Drawings"] = sample, ["Instructions"] = help });
        return ms.ToArray();
    }

    // ------------------------------------------------------------------ processing
    private sealed class Masters
    {
        public Dictionary<string, VehicleCategory> Cats = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, VehicleType> Types = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, Make> Makes = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, ConnectorType> Conns = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, VehicleModel> Models = new(StringComparer.OrdinalIgnoreCase);
        public HashSet<int> Volts = new();
        public HashSet<(int, string)> Ahs = new();
        public static string ModelKey(string make, string type, string cat, string name, string cap) => $"{make}|{type}|{cat}|{name}|{cap}";
    }

    private async Task<Masters> LoadMastersAsync(CancellationToken ct)
    {
        var m = new Masters();
        foreach (var x in await db.Categories.AsNoTracking().ToListAsync(ct)) m.Cats[x.Name] = x;
        foreach (var x in await db.VehicleTypes.AsNoTracking().ToListAsync(ct)) m.Types[x.Name] = x;
        foreach (var x in await db.Makes.AsNoTracking().ToListAsync(ct)) m.Makes[x.Name] = x;
        foreach (var x in await db.Connectors.AsNoTracking().ToListAsync(ct)) m.Conns[x.Name] = x;
        foreach (var x in await db.Models.AsNoTracking().ToListAsync(ct)) m.Models[Masters.ModelKey(x.MakeId, x.VehicleTypeId, x.CategoryId, x.ModelName, x.Capacity)] = x;
        foreach (var x in await db.Voltages.AsNoTracking().ToListAsync(ct)) m.Volts.Add(x.ValueV);
        foreach (var x in await db.AhRatings.AsNoTracking().ToListAsync(ct)) m.Ahs.Add((x.Value, x.Standard.ToUpperInvariant()));
        return m;
    }

    private static string Canon(string key) => new string(key.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant() switch
    {
        "drawingno" or "drawingnumber" => "number",
        "category" or "vehiclecategory" => "cat",
        "make" or "vehiclemake" or "oem" => "make",
        "type" or "vehicletype" => "type",
        "model" or "modelno" or "vehiclemodel" => "model",
        "capacity" or "vehiclecapacity" => "cap",
        "voltage" or "voltagev" or "volts" => "volt",
        "ah" or "ahrating" => "ah",
        "connector" or "endconnector" or "sockettype" or "connectortype" => "conn",
        "length" or "lengthmm" or "l" => "len",
        "width" or "widthmm" or "w" => "wid",
        "height" or "heightmm" or "h" => "hei",
        "comments" or "comment" => "comments",
        "competitordrawingnumber" or "competitordrawingno" => "competitor",
        "drawingurl" or "url" or "fileurl" or "drawingbucketurl" or "bucketurl" => "url",
        var other => other
    };

    private static string S(IDictionary<string, string?> d, string k) => d.TryGetValue(k, out var v) ? (v ?? "").Trim() : "";
    private static bool TryInt(string s, out int n)
    {
        n = 0; s = s.Trim();
        if (int.TryParse(s, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out n)) return true;
        return double.TryParse(s, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var f) && f == Math.Floor(f) && (n = (int)f) >= 0;
    }

    public async Task ProcessAsync(string jobId, CancellationToken ct)
    {
        var job = await db.BulkJobs.FirstAsync(j => j.Id == jobId, ct);
        job.Status = JobStatus.Running; job.StartedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        try
        {
            var s = await settings.GetAsync(ct);
            var o = bulk.Value;
            var total = 0;
            foreach (var _ in MiniExcel.Query(job.TempPath, useHeaderRow: true)) if (++total > o.MaxRows) throw new InvalidOperationException($"The sheet has more than {o.MaxRows} rows. Split it into smaller files.");
            job.TotalRows = total; await db.SaveChangesAsync(ct);

            var masters = await LoadMastersAsync(ct);
            var existing = (await db.Drawings.IgnoreQueryFilters().AsNoTracking().Select(d => d.DrawingNumber).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var batch = new List<(int Row, Dictionary<string, string?> Cells)>();
            var rowNo = 1;
            foreach (var item in MiniExcel.Query(job.TempPath, useHeaderRow: true))
            {
                ct.ThrowIfCancellationRequested();
                rowNo++;
                var cells = new Dictionary<string, string?>();
                foreach (var kv in (IDictionary<string, object?>)item)
                {
                    var v = kv.Value switch { null => null, double d => d.ToString("0.##########", System.Globalization.CultureInfo.InvariantCulture), DateTime dt => dt.ToString("o"), var x => x.ToString() };
                    cells[Canon(kv.Key)] = v;
                }
                if (cells.Values.All(string.IsNullOrWhiteSpace)) { job.ProcessedRows++; continue; }
                batch.Add((rowNo, cells));
                if (batch.Count >= o.BatchSize) { masters = await ProcessBatchAsync(job, batch, masters, existing, s, ct); batch.Clear(); await Task.Delay(o.BatchDelayMs, ct); }
            }
            if (batch.Count > 0) await ProcessBatchAsync(job, batch, masters, existing, s, ct);
            job.Status = job.ErrorCount > 0 ? JobStatus.CompletedWithErrors : JobStatus.Completed;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Bulk import {Job} failed", jobId);
            job.Status = JobStatus.Failed; job.FailureMessage = Text.Truncate(ex.Message, 900);
        }
        finally
        {
            job.FinishedAtUtc = DateTime.UtcNow;
            try { if (File.Exists(job.TempPath)) File.Delete(job.TempPath); } catch { /* ignore */ }
        }
        db.Attach(job).State = EntityState.Modified;
        audit.Add("BulkImportFinished", "BulkImport", job.Id, $"Bulk import '{job.OriginalFileName}' {job.Status}: {job.CreatedCount} created, {job.SkippedCount} skipped, {job.ErrorCount} errors", actorId: job.RequestedById, actorEmail: "bulk-import");
        notifier.InApp(job.RequestedById, $"Bulk import {job.Status}", $"{job.CreatedCount} created, {job.SkippedCount} skipped, {job.ErrorCount} errors", "/admin/bulk-import");
        await db.SaveChangesAsync(CancellationToken.None);
    }

    private async Task<Masters> ProcessBatchAsync(BulkImportJob job, List<(int Row, Dictionary<string, string?> Cells)> rows, Masters m,
        HashSet<string> existing, DrawingSettings s, CancellationToken ct)
    {
        var errors = new List<BulkImportRowError>();
        void Err(int row, string? num, string msg) { job.ErrorCount++; if (job.ErrorCount <= 5000) errors.Add(new BulkImportRowError { JobId = job.Id, RowNumber = row, DrawingNumber = num is null ? null : Text.Truncate(num, 60), Message = Text.Truncate(msg, 480) }); }

        var fileIds = rows.Select(r => FileIdInUrl.Match(S(r.Cells, "url"))).Where(x => x.Success).Select(x => x.Groups[1].Value.ToLowerInvariant()).Distinct().ToList();
        var files = fileIds.Count == 0 ? new Dictionary<string, StoredFile>() :
            await db.Files.AsNoTracking().Where(f => fileIds.Contains(f.Id) && f.Kind == FileKind.Drawing).ToDictionaryAsync(f => f.Id, ct);

        var newDrawings = new List<Drawing>(); var newRevs = new List<DrawingRevision>(); var created = 0; var skipped = 0;
        var newMasters = new List<object>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (row, c) in rows)
        {
            job.ProcessedRows++;
            var num = DrawingNumberFormat.Normalize(S(c, "number"));
            if (num.Length == 0) { Err(row, null, "DrawingNumber is empty."); continue; }
            if (!s.Format.IsMatch(num)) { Err(row, num, $"Drawing number does not match the format {s.Format.Mask} (example {s.Format.Example})."); continue; }
            if (existing.Contains(num) || seen.Contains(num))
            {
                if (job.SkipDuplicates) { skipped++; continue; }
                Err(row, num, existing.Contains(num) ? "Drawing number already exists." : "Duplicate drawing number inside the file."); continue;
            }
            string catN = Text.Clean(S(c, "cat"), 60), makeN = Text.Clean(S(c, "make"), 100), typeN = Text.Clean(S(c, "type"), 100), modelN = Text.Clean(S(c, "model"), 120),
                   capN = Text.Clean(S(c, "cap"), 40), connN = Text.Clean(S(c, "conn"), 100);
            var missing = new[] { ("Category", catN), ("Make", makeN), ("VehicleType", typeN), ("Model", modelN), ("Capacity", capN), ("Connector", connN) }.Where(x => x.Item2.Length == 0).Select(x => x.Item1).ToList();
            if (missing.Count > 0) { Err(row, num, $"Missing: {string.Join(", ", missing)}."); continue; }
            if (!TryInt(S(c, "volt"), out var volt) || volt is < 1 or > 2000) { Err(row, num, "Voltage must be a number in volts."); continue; }
            var ahM = AhPattern.Match(S(c, "ah"));
            if (!ahM.Success) { Err(row, num, "AhRating must look like 560 or 620(DIN)."); continue; }
            var ah = int.Parse(ahM.Groups[1].Value); var std = ahM.Groups[2].Success ? ahM.Groups[2].Value.Trim().ToUpperInvariant() : "";
            if (ah < 1) { Err(row, num, "AhRating must be greater than zero."); continue; }
            if (!TryInt(S(c, "len"), out var len) || len is < 100 or > 9999 || !TryInt(S(c, "wid"), out var wid) || wid is < 100 or > 9999 || !TryInt(S(c, "hei"), out var hei) || hei is < 100 or > 9999)
            { Err(row, num, "Length, Width and Height must be numbers with 3 or 4 digits."); continue; }
            var urlM = FileIdInUrl.Match(S(c, "url"));
            if (!urlM.Success) { Err(row, num, "DrawingUrl is missing or is not a URL generated by the Upload drawing screen."); continue; }
            if (!files.TryGetValue(urlM.Groups[1].Value.ToLowerInvariant(), out var file)) { Err(row, num, "The drawing file for this URL was not found on the server."); continue; }

            // master data (optionally auto-created)
            T? Get<T>(Dictionary<string, T> d, string name, Func<T> make, string label, out bool fail) where T : class
            {
                fail = false;
                if (d.TryGetValue(name, out var hit)) return hit;
                if (!job.AutoCreateMaster) { Err(row, num, $"{label} '{name}' does not exist in master data."); fail = true; return null; }
                var e = make(); d[name] = e; newMasters.Add(e); return e;
            }
            var cat = Get(m.Cats, catN, () => new VehicleCategory { Name = catN }, "Category", out var f1); if (f1) continue;
            var make = Get(m.Makes, makeN, () => new Make { Name = makeN }, "Make", out var f2); if (f2) continue;
            var type = Get(m.Types, typeN, () => new VehicleType { Name = typeN }, "Vehicle type", out var f3); if (f3) continue;
            var conn = Get(m.Conns, connN, () => new ConnectorType { Name = connN }, "Connector", out var f4); if (f4) continue;
            var mk = Masters.ModelKey(make!.Id, type!.Id, cat!.Id, modelN, capN);
            var model = Get(m.Models, mk, () => new VehicleModel { MakeId = make.Id, VehicleTypeId = type.Id, CategoryId = cat.Id, ModelName = modelN, Capacity = capN }, "Model", out var f5); if (f5) continue;
            if (!m.Volts.Contains(volt)) { if (!job.AutoCreateMaster) { Err(row, num, $"Voltage {volt} V is not in master data."); continue; } m.Volts.Add(volt); newMasters.Add(new VoltagePreset { ValueV = volt }); }
            if (!m.Ahs.Contains((ah, std))) { if (!job.AutoCreateMaster) { Err(row, num, $"Ah rating {DrawingMapper.AhLabel(ah, std)} is not in master data."); continue; } m.Ahs.Add((ah, std)); newMasters.Add(new AhRating { Value = ah, Standard = std }); }

            var d = new Drawing
            {
                DrawingNumber = num,
                ModelId = model!.Id,
                VoltageV = volt,
                AhValue = ah,
                AhStandard = std,
                LengthMm = len,
                WidthMm = wid,
                HeightMm = hei,
                ConnectorTypeId = conn!.Id,
                Comments = Text.NullIfEmpty(Text.CleanMultiline(S(c, "comments"), 2000)),
                CompetitorDrawingNumber = Text.NullIfEmpty(Text.Clean(S(c, "competitor"), 60)),
                CurrentRevisionNo = 1,
                CurrentFileId = file.Id,
                CreatedById = job.RequestedById,
            };
            newDrawings.Add(d); seen.Add(num);
            newRevs.Add(new DrawingRevision { DrawingId = d.Id, RevisionNo = 1, DrawingNumber = num, FileId = file.Id, ChangeNotes = "Imported from Excel", CreatedById = job.RequestedById });
            created++;
        }

        try
        {
            foreach (var e in newMasters) db.Add(e);
            db.Drawings.AddRange(newDrawings); db.Revisions.AddRange(newRevs); db.BulkErrors.AddRange(errors);
            job.CreatedCount += created; job.SkippedCount += skipped;
            await db.SaveChangesAsync(ct);
            foreach (var d in newDrawings) existing.Add(d.DrawingNumber);
            if (newMasters.Count > 0) versions.Bump();
        }
        catch (DbUpdateException ex)
        {
            log.LogError(ex, "Bulk batch failed");
            db.ChangeTracker.Clear();
            job.CreatedCount -= created; job.SkippedCount -= skipped;
            job.ErrorCount += created;
            db.Attach(job).State = EntityState.Modified;
            db.BulkErrors.Add(new BulkImportRowError { JobId = job.Id, RowNumber = rows[0].Row, Message = $"A database error rejected rows {rows[0].Row}-{rows[^1].Row}: {Text.Truncate(ex.GetBaseException().Message, 300)}" });
            await db.SaveChangesAsync(ct);
            return await LoadMastersAsync(ct);
        }
        db.ChangeTracker.Clear();
        db.Attach(job).State = EntityState.Modified;
        await db.SaveChangesAsync(ct);
        return m;
    }
}