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
    Task<BulkFileUploadDto> UploadFileAsync(IFormFile file, CancellationToken ct);
    Task<BulkCheckDto> CheckAsync(IFormFile file, CancellationToken ct);
}

/// <summary>
/// Admin first uploads the drawing files in bulk (file name = drawing number, e.g. "25 600 002 B(48V-775 AH).pdf"), then an .xlsx with one row per drawing.
/// A row is joined to its file by drawing number + voltage + Ah (or by the DrawingUrl column, when one is given); rows whose file is missing are reported so the admin can upload it and import again.
/// Processing runs on a dedicated background worker (one job at a time): the sheet is STREAMED (never fully loaded), rows are validated in memory
/// against pre-loaded master data, and inserted in batches with a short pause between batches so interactive traffic is never starved.
/// </summary>
public sealed class BulkImportService(AppDbContext db, ISettingsService settings, INotifier notifier, IAuditService audit, ICurrentUser me,
    BulkImportQueue queue, ICacheVersion versions, IFileStorage storageService, IOptions<BulkOptions> bulk, IOptions<StorageOptions> storage, IWebHostEnvironment env, ILogger<BulkImportService> log) : IBulkImportService
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

    // ------------------------------------------------------------------ bulk file upload + dry-run check
    public async Task<BulkFileUploadDto> UploadFileAsync(IFormFile file, CancellationToken ct)
    {
        var display = FileRules.SafeDisplayName(file.FileName);
        var parsed = DrawingFileName.Parse(display);
        var s = await settings.GetAsync(ct);
        if (parsed is null || !s.Format.IsMatch(parsed.Number))
            throw ApiException.BadRequest($"The file name must start with the drawing number, for example \"25 600 002 B(48V-775 AH).pdf\" (drawing number format {s.Format.Mask}).", "file");
        var stored = await storageService.SaveDrawingKeepingNameAsync(file, me.Id, ct);
        string? note = parsed.VoltageV is null || parsed.Ah is null ? "No (voltage-Ah) in the file name: this file will be used for every row of this drawing number that has no file of its own." : null;
        var ahText = parsed.Ah is null ? null : DrawingMapper.AhLabel(parsed.Ah.Value, parsed.Standard);
        return new BulkFileUploadDto(stored.Id, display, parsed.Number, parsed.VoltageV, ahText, stored.WasExisting, note);
    }

    private async Task<DrawingFileIndex> BuildFileIndexAsync(CancellationToken ct) =>
        DrawingFileIndex.Build((await db.Files.AsNoTracking().Where(f => f.Kind == FileKind.Drawing).Select(f => new { f.Id, f.OriginalName, f.CreatedAtUtc }).ToListAsync(ct))
            .Select(f => (f.Id, f.OriginalName, f.CreatedAtUtc)));

    public async Task<BulkCheckDto> CheckAsync(IFormFile file, CancellationToken ct)
    {
        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase)) throw ApiException.BadRequest("Upload an Excel .xlsx file.", "file");
        if (file.Length == 0 || file.Length > bulk.Value.MaxFileMb * 1024L * 1024) throw ApiException.BadRequest($"The Excel file must be between 1 byte and {bulk.Value.MaxFileMb} MB.", "file");
        var s = await settings.GetAsync(ct);
        var index = await BuildFileIndexAsync(ct);
        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct); ms.Position = 0;
        var sig = ms.GetBuffer(); if (ms.Length < 4 || sig[0] != 0x50 || sig[1] != 0x4B) throw ApiException.BadRequest("This is not a valid .xlsx file.", "file");

        const int Cap = 500;
        var missing = new List<BulkMissingFileDto>(); var invalid = new List<BulkErrorDto>();
        int total = 0, ready = 0, missingCount = 0, invalidCount = 0, rowNo = 1;
        var usedFiles = new HashSet<string>();
        foreach (var item in MiniExcel.Query(ms, useHeaderRow: true))
        {
            ct.ThrowIfCancellationRequested();
            rowNo++;
            var c = ReadCells((IDictionary<string, object?>)item);
            if (c.Values.All(string.IsNullOrWhiteSpace)) continue;
            if (++total > bulk.Value.MaxRows) throw ApiException.BadRequest($"The sheet has more than {bulk.Value.MaxRows} rows. Split it into smaller files.", "file");
            var num = DrawingNumberFormat.Normalize(S(c, "number"));
            void Bad(string msg) { invalidCount++; if (invalid.Count < Cap) invalid.Add(new BulkErrorDto(rowNo, num.Length == 0 ? null : num, msg)); }
            if (num.Length == 0) { Bad("DrawingNumber is empty."); continue; }
            if (!s.Format.IsMatch(num)) { Bad($"Drawing number does not match the format {s.Format.Mask}."); continue; }
            if (S(c, "url").Length > 0)   // a pasted URL wins over the file name
            {
                if (FileIdInUrl.IsMatch(S(c, "url"))) { ready++; continue; }
                Bad("DrawingUrl is not a URL generated by the Upload drawing screen (leave it empty to use the uploaded file with the matching name)."); continue;
            }
            int? volt = TryInt(S(c, "volt"), out var v) && v is >= 1 and <= 2000 ? v : null;
            var ahM = AhPattern.Match(S(c, "ah"));
            int? ah = ahM.Success && int.Parse(ahM.Groups[1].Value) > 0 ? int.Parse(ahM.Groups[1].Value) : null;
            var std = ahM.Success && ahM.Groups[2].Success ? ahM.Groups[2].Value.Trim().ToUpperInvariant() : "";
            if (volt is null) { Bad("Voltage must be a number in volts."); continue; }
            if (ah is null) { Bad("AhRating must look like 560 or 620(DIN)."); continue; }
            var hit = index.Find(num, volt, ah);
            if (hit is null)
            {
                missingCount++;
                if (missing.Count < Cap) missing.Add(new BulkMissingFileDto(rowNo, num, DrawingFileName.Expected(num, volt, ah, std)));
            }
            else { ready++; usedFiles.Add(hit.Id); }
        }

        // files that were uploaded but no row of this Excel (and no existing drawing) uses
        var referenced = (await db.Revisions.AsNoTracking().Where(r => r.FileId != null).Select(r => r.FileId!).Distinct().ToListAsync(ct)).ToHashSet();
        var unused = index.All.Where(e => !usedFiles.Contains(e.Id) && !referenced.Contains(e.Id)).Select(e => e.Name).Order().ToList();
        return new BulkCheckDto(total, ready, missingCount, missing, invalidCount, invalid, unused.Count, unused.Take(Cap).ToList());
    }

    // ------------------------------------------------------------------ template
    public byte[] BuildTemplate()
    {
        var sample = new List<Dictionary<string, object?>>
        {
            new() { ["DrawingNumber"] = "25 600 001 A", ["Category"] = "Imports", ["Make"] = "Jungheinrich", ["VehicleType"] = "Reach Truck", ["Model"] = "ETV 320", ["Capacity"] = "1.8 T", ["Voltage"] = 48, ["AhRating"] = "620(DIN)", ["Connector"] = "SR 350A", ["Length"] = 1220, ["Width"] = 350, ["Height"] = 780, ["Comments"] = "", ["CompetitorDrawingNumber"] = "", ["DrawingUrl"] = "" },
        };
        var help = new List<Dictionary<string, object?>>
        {
            new() { ["Column"] = "DrawingNumber", ["Rule"] = "Must match the drawing number format configured by the admin (default ## ### ### A). To use ONE number for several makes / models, add one row per vehicle with the same DrawingNumber (the DrawingUrl may be the same or different)." },
            new() { ["Column"] = "Category / Make / VehicleType / Model / Capacity / Connector", ["Rule"] = "Must exist in master data, unless 'Create missing master data' is ticked on the import screen." },
            new() { ["Column"] = "Voltage", ["Rule"] = "Number in volts, for example 48." },
            new() { ["Column"] = "AhRating", ["Rule"] = "Number, optionally followed by a standard in brackets: 560 or 620(DIN)." },
            new() { ["Column"] = "Length / Width / Height", ["Rule"] = "Tray dimensions in mm, 3 or 4 digits." },
            new() { ["Column"] = "DrawingUrl", ["Rule"] = "OPTIONAL. Leave it empty when you uploaded the drawing files in bulk: each row is joined to the file named '<DrawingNumber>(<Voltage>V-<Ah> AH).pdf', for example '25 600 002 B(48V-775 AH).pdf'. Or paste the URL shown after uploading a file on the 'Upload drawing' screen (a URL always wins over the file name). The same file may be used on several rows." },
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
        "drawingno" or "drawingnumber" => "number", "category" or "vehiclecategory" => "cat", "make" or "vehiclemake" or "oem" => "make",
        "type" or "vehicletype" => "type", "model" or "modelno" or "vehiclemodel" => "model", "capacity" or "vehiclecapacity" => "cap",
        "voltage" or "voltagev" or "volts" => "volt", "ah" or "ahrating" => "ah", "connector" or "endconnector" or "sockettype" or "connectortype" => "conn",
        "length" or "lengthmm" or "l" => "len", "width" or "widthmm" or "w" => "wid", "height" or "heightmm" or "h" => "hei",
        "comments" or "comment" => "comments", "competitordrawingnumber" or "competitordrawingno" => "competitor",
        "drawingurl" or "url" or "fileurl" or "drawingbucketurl" or "bucketurl" => "url", var other => other
    };

    private static Dictionary<string, string?> ReadCells(IDictionary<string, object?> item)
    {
        var cells = new Dictionary<string, string?>();
        foreach (var kv in item)
        {
            var v = kv.Value switch { null => null, double d => d.ToString("0.##########", System.Globalization.CultureInfo.InvariantCulture), DateTime dt => dt.ToString("o"), var x => x.ToString() };
            cells[Canon(kv.Key)] = v;
        }
        return cells;
    }

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
            var fileIndex = await BuildFileIndexAsync(ct);
            var existing = (await db.Drawings.AsNoTracking().Select(d => new { d.DrawingNumber, d.ModelId, d.VoltageV, d.AhValue, d.AhStandard }).ToListAsync(ct)).Select(d => Key(d.DrawingNumber, d.ModelId, d.VoltageV, d.AhValue, d.AhStandard)).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var batch = new List<(int Row, Dictionary<string, string?> Cells)>();
            var rowNo = 1;
            foreach (var item in MiniExcel.Query(job.TempPath, useHeaderRow: true))
            {
                ct.ThrowIfCancellationRequested();
                rowNo++;
                var cells = ReadCells((IDictionary<string, object?>)item);
                if (cells.Values.All(string.IsNullOrWhiteSpace)) { job.ProcessedRows++; continue; }
                batch.Add((rowNo, cells));
                if (batch.Count >= o.BatchSize) { masters = await ProcessBatchAsync(job, batch, masters, existing, s, fileIndex, ct); batch.Clear(); await Task.Delay(o.BatchDelayMs, ct); }
            }
            if (batch.Count > 0) await ProcessBatchAsync(job, batch, masters, existing, s, fileIndex, ct);
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

    private static string Key(string num, string modelId, int volt, int ah, string? std) => $"{num}|{modelId}|{volt}|{ah}|{std ?? ""}";

    private async Task<Masters> ProcessBatchAsync(BulkImportJob job, List<(int Row, Dictionary<string, string?> Cells)> rows, Masters m,
        HashSet<string> existing, DrawingSettings s, DrawingFileIndex fileIndex, CancellationToken ct)
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
            string fileId;
            if (S(c, "url").Length > 0)
            {
                var urlM = FileIdInUrl.Match(S(c, "url"));
                if (!urlM.Success) { Err(row, num, "DrawingUrl is not a URL generated by the Upload drawing screen (leave it empty to use the uploaded file with the matching name)."); continue; }
                if (!files.TryGetValue(urlM.Groups[1].Value.ToLowerInvariant(), out var file)) { Err(row, num, "The drawing file for this URL was not found on the server."); continue; }
                fileId = file.Id;
            }
            else
            {   // no URL: join the row to the bulk-uploaded file named after its drawing number, voltage and Ah
                var hit = fileIndex.Find(num, volt, ah);
                if (hit is null) { Err(row, num, $"Drawing file missing. Upload a file named \"{DrawingFileName.Expected(num, volt, ah, std)}\" and import again (rows already imported are skipped)."); continue; }
                fileId = hit.Id;
            }

            // master data (optionally auto-created)
            T? Get<T>(Dictionary<string, T> d, string name, Func<T> make, string label, out bool fail) where T : class
            {
                fail = false;
                if (d.TryGetValue(name, out var hit)) return hit;
                if (!job.AutoCreateMaster) { Err(row, num, $"{label} '{(label == "Model" ? $"{modelN} ({capN})" : name)}' does not exist in master data. Tick \"Create missing master data\" to add it automatically."); fail = true; return null; }
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

            // same number for several makes / models, and several drawings for one vehicle, are fine; only an exact repeat is a duplicate
            var dupKey = Key(num, model!.Id, volt, ah, std);
            if (existing.Contains(dupKey) || seen.Contains(dupKey))
            {
                if (job.SkipDuplicates) { skipped++; continue; }
                Err(row, num, existing.Contains(dupKey) ? "This drawing number already exists for the same model, voltage and Ah rating." : "Same drawing number, model, voltage and Ah repeated inside the file."); continue;
            }
            var d = new Drawing
            {
                DrawingNumber = num, ModelId = model!.Id, VoltageV = volt, AhValue = ah, AhStandard = std, LengthMm = len, WidthMm = wid, HeightMm = hei, ConnectorTypeId = conn!.Id,
                Comments = Text.NullIfEmpty(Text.CleanMultiline(S(c, "comments"), 2000)), CompetitorDrawingNumber = Text.NullIfEmpty(Text.Clean(S(c, "competitor"), 60)),
                CurrentRevisionNo = 1, CurrentFileId = fileId, CreatedById = job.RequestedById,
            };
            newDrawings.Add(d); seen.Add(dupKey);
            newRevs.Add(new DrawingRevision { DrawingId = d.Id, RevisionNo = 1, DrawingNumber = num, FileId = fileId, ChangeNotes = "Imported from Excel", CreatedById = job.RequestedById });
            created++;
        }

        try
        {
            foreach (var e in newMasters) db.Add(e);
            db.Drawings.AddRange(newDrawings); db.Revisions.AddRange(newRevs); db.BulkErrors.AddRange(errors);
            job.CreatedCount += created; job.SkippedCount += skipped;
            await db.SaveChangesAsync(ct);
            foreach (var d in newDrawings) existing.Add(Key(d.DrawingNumber, d.ModelId, d.VoltageV, d.AhValue, d.AhStandard));
            foreach (var g in newDrawings.GroupBy(d => (d.ModelId, d.VoltageV, d.AhValue, d.AhStandard))) await MasterDataService.LinkBatteryAsync(db, g.Key.ModelId, g.Key.VoltageV, g.Key.AhValue, g.Key.AhStandard, ct);
            if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);
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