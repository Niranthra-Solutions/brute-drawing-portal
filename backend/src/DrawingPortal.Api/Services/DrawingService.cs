using System.Text.Json;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using DrawingPortal.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Services;

public interface IDrawingService
{
    Task<SearchResultDto> SearchAsync(SearchQueryDto q, CancellationToken ct);
    Task<DrawingDetailDto> FindByNumberAsync(string number, CancellationToken ct);
    Task<DrawingDetailDto> GetAsync(string id, CancellationToken ct);
    Task<PagedResult<DrawingDto>> ListAsync(DrawingListQuery q, CancellationToken ct);
    Task<DrawingDetailDto> CreateAsync(CreateDrawingDto dto, CancellationToken ct);
    Task<DrawingDetailDto> UpdateAsync(string id, UpdateDrawingDto dto, CancellationToken ct);
    Task<DrawingDetailDto> AddRevisionAsync(string id, AddRevisionDto dto, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
}

public sealed class DrawingService(AppDbContext db, ISettingsService settings, ICurrentUser user, IAuditService audit,
    IRequestWorkflow workflow, IOptions<PortalOptions> portal, ICacheVersion versions) : IDrawingService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // ====================================================================== SEARCH
    public async Task<SearchResultDto> SearchAsync(SearchQueryDto q, CancellationToken ct)
    {
        var errs = new FieldErrors();
        if (q.VoltageV is < 1 or > 2000) errs.Add("voltageV", "Select a voltage.");
        ValidateDims(errs, q.LengthMm, q.WidthMm, q.HeightMm, "");
        errs.ThrowIfAny();

        var s = await settings.GetAsync(ct);
        var tol = new Tolerance(s.ToleranceLengthMm, s.ToleranceWidthMm, s.ToleranceHeightMm);
        var std = (q.AhStandard ?? "").Trim().ToUpperInvariant();
        var makeId = q.ModelId is null ? null : await db.Models.AsNoTracking().Where(m => m.Id == q.ModelId).Select(m => m.MakeId).FirstOrDefaultAsync(ct);
        var criteria = new SearchCriteria(q.ModelId, makeId, q.VoltageV, q.AhValue, std, q.LengthMm, q.WidthMm, q.HeightMm);
        var tolDto = new ToleranceDto(tol.LengthMm, tol.WidthMm, tol.HeightMm);

        // 1) Standard drawing: ALL inputs match (BRD 1.5)
        var exact = new List<DrawingRow>();
        if (q.ModelId is not null)
            exact = await db.Drawings.AsNoTracking()
                .Where(d => d.Status == DrawingStatus.Active && d.ModelId == q.ModelId && d.VoltageV == q.VoltageV && d.AhValue == q.AhValue && d.AhStandard == std
                         && d.LengthMm == q.LengthMm && d.WidthMm == q.WidthMm && d.HeightMm == q.HeightMm)
                .OrderBy(d => d.DrawingNumber).Select(DrawingMapper.Row).ToListAsync(ct);

        // 2) Non-standard suggestions (BRD 1.8): only when no exact match, or when the user explicitly asks for similar ones too.
        var similar = new List<SuggestionDto>();
        var totalCandidates = 0;
        if (exact.Count == 0 || q.IncludeSimilar)
        {
            int l = q.LengthMm, w = q.WidthMm, h = q.HeightMm;
            var exactIds = exact.Select(e => e.Id).ToHashSet();
            var candidates = await db.Drawings.AsNoTracking()
                .Where(d => d.Status == DrawingStatus.Active && d.VoltageV == q.VoltageV
                         && d.LengthMm >= l - tol.LengthMm && d.LengthMm <= l + tol.LengthMm
                         && d.WidthMm >= w - tol.WidthMm && d.WidthMm <= w + tol.WidthMm
                         && d.HeightMm >= h - tol.HeightMm && d.HeightMm <= h + tol.HeightMm)
                .Select(d => new DrawingFacts(d.Id, d.DrawingNumber, d.ModelId, d.Model!.MakeId, d.VoltageV, d.AhValue, d.AhStandard, d.LengthMm, d.WidthMm, d.HeightMm))
                .ToListAsync(ct);
            candidates = candidates.Where(c => !exactIds.Contains(c.Id)).ToList();
            totalCandidates = candidates.Count;
            var ranked = SuggestionEngine.Rank(candidates, criteria, tol, portal.Value.MaxSuggestions);
            if (ranked.Count > 0)
            {
                var ids = ranked.Select(r => r.Drawing.Id).ToList();
                var rows = (await db.Drawings.AsNoTracking().Where(d => ids.Contains(d.Id)).Select(DrawingMapper.Row).ToListAsync(ct)).ToDictionary(r => r.Id);
                similar = ranked.Select(r => new SuggestionDto(DrawingMapper.ToDto(rows[r.Drawing.Id]), r.DeltaLength, r.DeltaWidth, r.DeltaHeight, r.FitPercent, r.SameModel, r.SameMake, r.SameAh)).ToList();
            }
        }

        var mode = exact.Count > 0 ? "Standard" : similar.Count > 0 ? "NonStandard" : "None";
        var note = mode == "NonStandard"
            ? "No exact match was found. The drawings below are non-standard suggestions based on the closest dimension tolerances. Please select the drawing that best matches your requirement."
            : mode == "None" ? "No standard drawing or close match was found. You can raise a new drawing request." : null;
        return new SearchResultDto(mode, exact.Select(DrawingMapper.ToDto).ToList(), similar, tolDto, note, totalCandidates);
    }

    public async Task<DrawingDetailDto> FindByNumberAsync(string number, CancellationToken ct)
    {
        var s = await settings.GetAsync(ct);
        var n = DrawingNumberFormat.Normalize(number);
        if (!s.Format.IsMatch(n)) throw ApiException.BadRequest($"Enter the drawing number in the format {s.Format.Mask.Replace("#", "9")} (for example {s.Format.Example}).", "number");
        var q = db.Drawings.AsNoTracking();
        if (!user.IsAdmin) q = q.Where(d => d.Status == DrawingStatus.Active);
        var id = await q.Where(d => d.DrawingNumber == n).Select(d => d.Id).FirstOrDefaultAsync(ct);
        string? note = null;
        if (id is null)
        {
            // An older (superseded) number from a previous revision still resolves to the current drawing.
            id = await db.Revisions.AsNoTracking().Where(r => r.DrawingNumber == n && (user.IsAdmin || r.Drawing!.Status == DrawingStatus.Active))
                .OrderByDescending(r => r.RevisionNo).Select(r => r.DrawingId).FirstOrDefaultAsync(ct);
            if (id is not null) note = $"{n} is a superseded drawing number. Showing the current drawing.";
        }
        if (id is null) throw ApiException.NotFound($"No drawing was found with number {n}.");
        var detail = await GetAsync(id, ct);
        return detail with { MatchedNote = note };
    }

    // ====================================================================== READ
    public async Task<DrawingDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var row = await db.Drawings.AsNoTracking().Where(d => d.Id == id).Select(DrawingMapper.Row).FirstOrDefaultAsync(ct);
        if (row is null || (!user.IsAdmin && row.Status != DrawingStatus.Active)) throw ApiException.NotFound("Drawing not found.");
        var meta = await db.Drawings.AsNoTracking().Where(d => d.Id == id).Select(d => new { d.CreatedAtUtc, d.CreatedById }).FirstAsync(ct);
        var revs = await db.Revisions.AsNoTracking().Where(r => r.DrawingId == id).OrderByDescending(r => r.RevisionNo)
            .Select(r => new { r.Id, r.RevisionNo, r.DrawingNumber, r.FileId, FileName = r.File == null ? null : r.File.OriginalName, r.ChangeNotes, r.CreatedAtUtc, r.CreatedById, r.RequestId }).ToListAsync(ct);
        var userIds = revs.Select(r => r.CreatedById).Append(meta.CreatedById).Where(x => x != null).Distinct().ToList();
        var names = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        var reqIds = revs.Select(r => r.RequestId).Where(x => x != null).Distinct().ToList();
        var tickets = reqIds.Count == 0 ? new() : await db.Requests.AsNoTracking().Where(r => reqIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.TicketNo, ct);
        var revisions = revs.Select(r => new RevisionDto(r.Id, r.RevisionNo, Text.RevisionLabel(r.RevisionNo), r.DrawingNumber, r.FileId, r.FileName, r.ChangeNotes, r.CreatedAtUtc,
            r.CreatedById is not null && names.TryGetValue(r.CreatedById, out var n) ? n : null,
            r.RequestId is not null && tickets.TryGetValue(r.RequestId, out var t) ? t : null, r.RevisionNo == row.RevisionNo)).ToList();
        FileInfoDto? file = null;
        if (row.FileId is not null)
        {
            var f = await db.Files.AsNoTracking().FirstOrDefaultAsync(x => x.Id == row.FileId, ct);
            if (f is not null) file = new FileInfoDto(f.Id, f.OriginalName, f.ContentType, f.SizeBytes, f.Sha256, f.Url, f.CreatedAtUtc, DrawingMapper.IsPreviewable(f.OriginalName));
        }
        return new DrawingDetailDto(DrawingMapper.ToDto(row), revisions, file, meta.CreatedAtUtc, meta.CreatedById is not null && names.TryGetValue(meta.CreatedById, out var cn) ? cn : null, null);
    }

    public async Task<PagedResult<DrawingDto>> ListAsync(DrawingListQuery q, CancellationToken ct)
    {
        var (page, size) = PagingExtensions.Normalize(q.Page, q.PageSize);
        var qy = db.Drawings.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var t = q.Q.Trim(); var compact = t.Replace(" ", "");
            qy = qy.Where(d => d.DrawingNumber.Contains(t) || d.DrawingNumber.Replace(" ", "").Contains(compact) || d.Model!.ModelName.Contains(t)
                            || d.Model.Make!.Name.Contains(t) || (d.CompetitorDrawingNumber != null && d.CompetitorDrawingNumber.Contains(t)));
        }
        if (!string.IsNullOrEmpty(q.CategoryId)) qy = qy.Where(d => d.Model!.CategoryId == q.CategoryId);
        if (!string.IsNullOrEmpty(q.MakeId)) qy = qy.Where(d => d.Model!.MakeId == q.MakeId);
        if (q.VoltageV is not null) qy = qy.Where(d => d.VoltageV == q.VoltageV);
        if (q.Status is not null) qy = qy.Where(d => d.Status == q.Status);
        var desc = !string.Equals(q.Dir, "asc", StringComparison.OrdinalIgnoreCase);
        IOrderedQueryable<Drawing> ordered = (q.Sort?.ToLowerInvariant()) switch
        {
            "number" => desc ? qy.OrderByDescending(d => d.DrawingNumber) : qy.OrderBy(d => d.DrawingNumber),
            "make" => desc ? qy.OrderByDescending(d => d.Model!.Make!.Name) : qy.OrderBy(d => d.Model!.Make!.Name),
            "model" => desc ? qy.OrderByDescending(d => d.Model!.ModelName) : qy.OrderBy(d => d.Model!.ModelName),
            "voltage" => desc ? qy.OrderByDescending(d => d.VoltageV) : qy.OrderBy(d => d.VoltageV),
            "ah" => desc ? qy.OrderByDescending(d => d.AhValue) : qy.OrderBy(d => d.AhValue),
            "length" => desc ? qy.OrderByDescending(d => d.LengthMm) : qy.OrderBy(d => d.LengthMm),
            "status" => desc ? qy.OrderByDescending(d => d.Status) : qy.OrderBy(d => d.Status),
            _ => desc ? qy.OrderByDescending(d => d.UpdatedAtUtc) : qy.OrderBy(d => d.UpdatedAtUtc),
        };
        var total = await qy.CountAsync(ct);
        var rows = await ordered.ThenBy(d => d.Id).Skip((page - 1) * size).Take(size).Select(DrawingMapper.Row).ToListAsync(ct);
        return new PagedResult<DrawingDto>(rows.Select(DrawingMapper.ToDto).ToList(), total, page, size);
    }

    // ====================================================================== WRITE
    private static void ValidateDims(FieldErrors errs, int l, int w, int h, string prefix)
    {
        void Check(string f, int v, string label) { if (v is < 100 or > 9999) errs.Add(prefix + f, $"{label} must be a number with 3 or 4 digits."); }
        Check("lengthMm", l, "Length"); Check("widthMm", w, "Width"); Check("heightMm", h, "Height");
    }

    private async Task ValidateInputAsync(DrawingInput d, FieldErrors errs, DrawingSettings s, string? excludeId, CancellationToken ct)
    {
        var n = DrawingNumberFormat.Normalize(d.DrawingNumber);
        if (!s.Format.IsMatch(n)) errs.Add("drawingNumber", $"Drawing number must match the format {s.Format.Mask} (example: {s.Format.Example}).");
        else if (await db.Drawings.AnyAsync(x => x.DrawingNumber == n && x.Id != excludeId, ct)) errs.Add("drawingNumber", $"Drawing number {n} already exists.");
        if (d.VoltageV is < 1 or > 2000) errs.Add("voltageV", "Enter a valid voltage.");
        if (d.AhValue is < 1 or > 100000) errs.Add("ahValue", "Enter a valid Ah rating.");
        ValidateDims(errs, d.LengthMm, d.WidthMm, d.HeightMm, "");
        if (!await db.Models.AnyAsync(m => m.Id == d.ModelId, ct)) errs.Add("modelId", "Select a valid vehicle model.");
        if (!db.Connectors.Local.Any(c => c.Id == d.ConnectorTypeId) && !await db.Connectors.AnyAsync(c => c.Id == d.ConnectorTypeId, ct)) errs.Add("connectorTypeId", "Select a valid connector type.");
    }

    /// <summary>Resolves a free-text connector to a master record (matching by name, adding it when new). Returns the connector id, or null when nothing was given.</summary>
    private async Task<string?> ResolveConnectorAsync(string? id, string? name, FieldErrors errs, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(id)) return id;
        var n = Text.Clean(name, 100);
        if (n.Length == 0) return null;
        var hit = await db.Connectors.FirstOrDefaultAsync(c => c.Name == n, ct);
        if (hit is not null) { if (!hit.IsActive) hit.IsActive = true; return hit.Id; }
        var c = new ConnectorType { Name = n, IsActive = true };
        db.Connectors.Add(c); versions.Bump();
        return c.Id;
    }

    private string Snapshot(Drawing d) => JsonSerializer.Serialize(new { d.DrawingNumber, d.ModelId, d.VoltageV, d.AhValue, d.AhStandard, d.LengthMm, d.WidthMm, d.HeightMm, d.ConnectorTypeId }, Json);

    public async Task<DrawingDetailDto> CreateAsync(CreateDrawingDto dto, CancellationToken ct)
    {
        var s = await settings.GetAsync(ct);
        var errs = new FieldErrors();
        dto.ConnectorTypeId = await ResolveConnectorAsync(dto.ConnectorTypeId, dto.ConnectorName, errs, ct) ?? "";
        await ValidateInputAsync(dto, errs, s, null, ct);
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == dto.FileId && f.Kind == FileKind.Drawing, ct);
        if (file is null) errs.Add("fileId", "Upload a drawing file first.");
        errs.ThrowIfAny();

        var d = new Drawing
        {
            DrawingNumber = DrawingNumberFormat.Normalize(dto.DrawingNumber),
            ModelId = dto.ModelId,
            VoltageV = dto.VoltageV,
            AhValue = dto.AhValue,
            AhStandard = Text.Clean(dto.AhStandard, 20).ToUpperInvariant(),
            LengthMm = dto.LengthMm,
            WidthMm = dto.WidthMm,
            HeightMm = dto.HeightMm,
            ConnectorTypeId = dto.ConnectorTypeId,
            Comments = Text.NullIfEmpty(Text.CleanMultiline(dto.Comments, 2000)),
            CompetitorDrawingNumber = Text.NullIfEmpty(Text.Clean(dto.CompetitorDrawingNumber, 60)),
            CurrentRevisionNo = 1,
            CurrentFileId = file!.Id,
            CreatedById = user.Id,
        };
        db.Drawings.Add(d);
        var rev = new DrawingRevision
        {
            DrawingId = d.Id,
            RevisionNo = 1,
            DrawingNumber = d.DrawingNumber,
            FileId = file.Id,
            CreatedById = user.Id,
            RequestId = dto.RequestId,
            ChangeNotes = Text.NullIfEmpty(Text.CleanMultiline(dto.ChangeNotes, 2000)) ?? "Initial release",
            SnapshotJson = Snapshot(d)
        };
        db.Revisions.Add(rev);
        if (!string.IsNullOrEmpty(dto.RequestId)) await workflow.CompleteWithDrawingAsync(dto.RequestId, d, ct);
        audit.Add("DrawingCreated", "Drawing", d.Id, $"Created drawing {d.DrawingNumber}", new { d.DrawingNumber, file = file.Id, dto.RequestId });
        await SaveAsync(ct);
        return await GetAsync(d.Id, ct);
    }

    public async Task<DrawingDetailDto> UpdateAsync(string id, UpdateDrawingDto dto, CancellationToken ct)
    {
        var d = await db.Drawings.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Drawing not found.");
        var s = await settings.GetAsync(ct);
        var errs = new FieldErrors();
        dto.ConnectorTypeId = await ResolveConnectorAsync(dto.ConnectorTypeId, dto.ConnectorName, errs, ct) ?? "";
        await ValidateInputAsync(dto, errs, s, id, ct);
        StoredFile? newFile = null;
        if (!string.IsNullOrWhiteSpace(dto.FileId) && dto.FileId != d.CurrentFileId)
        {
            newFile = await db.Files.FirstOrDefaultAsync(f => f.Id == dto.FileId && f.Kind == FileKind.Drawing, ct);
            if (newFile is null) errs.Add("fileId", "Upload the corrected drawing file first.");
        }
        errs.ThrowIfAny();
        var before = Snapshot(d);
        if (newFile is not null)
        {
            // correction of a wrong upload: swap the file on the current revision, do not create a new revision
            var cur = await db.Revisions.FirstOrDefaultAsync(r => r.DrawingId == id && r.RevisionNo == d.CurrentRevisionNo, ct);
            if (cur is not null) cur.FileId = newFile.Id;
            audit.Add("DrawingFileReplaced", "Drawing", d.Id, $"Drawing file corrected on {d.DrawingNumber}", new { oldFile = d.CurrentFileId, newFile = newFile.Id });
            d.CurrentFileId = newFile.Id;
        }
        d.DrawingNumber = DrawingNumberFormat.Normalize(dto.DrawingNumber); d.ModelId = dto.ModelId; d.VoltageV = dto.VoltageV; d.AhValue = dto.AhValue;
        d.AhStandard = Text.Clean(dto.AhStandard, 20).ToUpperInvariant(); d.LengthMm = dto.LengthMm; d.WidthMm = dto.WidthMm; d.HeightMm = dto.HeightMm;
        d.ConnectorTypeId = dto.ConnectorTypeId; d.Comments = Text.NullIfEmpty(Text.CleanMultiline(dto.Comments, 2000));
        d.CompetitorDrawingNumber = Text.NullIfEmpty(Text.Clean(dto.CompetitorDrawingNumber, 60)); d.Status = dto.Status; d.UpdatedAtUtc = DateTime.UtcNow;
        audit.Add("DrawingUpdated", "Drawing", d.Id, $"Updated drawing {d.DrawingNumber}", new { before = JsonDocument.Parse(before).RootElement, after = JsonDocument.Parse(Snapshot(d)).RootElement, status = d.Status.ToString() });
        await SaveAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<DrawingDetailDto> AddRevisionAsync(string id, AddRevisionDto dto, CancellationToken ct)
    {
        var d = await db.Drawings.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Drawing not found.");
        var s = await settings.GetAsync(ct);
        var errs = new FieldErrors();
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == dto.FileId && f.Kind == FileKind.Drawing, ct);
        if (file is null) errs.Add("fileId", "Upload the revised drawing file first.");

        dto.ConnectorTypeId = await ResolveConnectorAsync(dto.ConnectorTypeId, dto.ConnectorName, errs, ct);
        var newNumber = string.IsNullOrWhiteSpace(dto.NewDrawingNumber) ? d.DrawingNumber : DrawingNumberFormat.Normalize(dto.NewDrawingNumber);
        if (newNumber != d.DrawingNumber)
        {
            if (!s.Format.IsMatch(newNumber)) errs.Add("newDrawingNumber", $"Drawing number must match the format {s.Format.Mask} (example: {s.Format.Example}).");
            else if (await db.Drawings.AnyAsync(x => x.DrawingNumber == newNumber && x.Id != id, ct)) errs.Add("newDrawingNumber", $"Drawing number {newNumber} already exists.");
        }
        if (dto.ModelId is not null && !await db.Models.AnyAsync(m => m.Id == dto.ModelId, ct)) errs.Add("modelId", "Select a valid vehicle model.");
        if (dto.ConnectorTypeId is not null && !db.Connectors.Local.Any(c => c.Id == dto.ConnectorTypeId) && !await db.Connectors.AnyAsync(c => c.Id == dto.ConnectorTypeId, ct)) errs.Add("connectorTypeId", "Select a valid connector type.");
        ValidateDims(errs, dto.LengthMm ?? d.LengthMm, dto.WidthMm ?? d.WidthMm, dto.HeightMm ?? d.HeightMm, "");
        errs.ThrowIfAny();

        var before = Snapshot(d);
        d.DrawingNumber = newNumber; d.ModelId = dto.ModelId ?? d.ModelId; d.VoltageV = dto.VoltageV ?? d.VoltageV; d.AhValue = dto.AhValue ?? d.AhValue;
        if (dto.AhStandard is not null) d.AhStandard = Text.Clean(dto.AhStandard, 20).ToUpperInvariant();
        d.LengthMm = dto.LengthMm ?? d.LengthMm; d.WidthMm = dto.WidthMm ?? d.WidthMm; d.HeightMm = dto.HeightMm ?? d.HeightMm; d.ConnectorTypeId = dto.ConnectorTypeId ?? d.ConnectorTypeId;
        var last = await db.Revisions.Where(r => r.DrawingId == id).Select(r => (int?)r.RevisionNo).MaxAsync(ct) ?? 0;
        var rev = new DrawingRevision
        {
            DrawingId = id,
            RevisionNo = last + 1,
            DrawingNumber = d.DrawingNumber,
            FileId = file!.Id,
            CreatedById = user.Id,
            RequestId = dto.RequestId,
            ChangeNotes = Text.CleanMultiline(dto.ChangeNotes, 2000),
            SnapshotJson = Snapshot(d)
        };
        db.Revisions.Add(rev);
        d.CurrentRevisionNo = rev.RevisionNo; d.CurrentFileId = file.Id; d.UpdatedAtUtc = DateTime.UtcNow; d.Status = DrawingStatus.Active;
        if (!string.IsNullOrEmpty(dto.RequestId)) await workflow.CompleteWithDrawingAsync(dto.RequestId, d, ct);
        audit.Add("RevisionAdded", "Drawing", d.Id, $"Revision {Text.RevisionLabel(rev.RevisionNo)} added to {d.DrawingNumber}",
            new { revision = rev.RevisionNo, before = JsonDocument.Parse(before).RootElement, after = JsonDocument.Parse(rev.SnapshotJson!).RootElement, dto.RequestId });
        await SaveAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var d = await db.Drawings.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Drawing not found.");
        d.IsDeleted = true; d.DeletedAtUtc = DateTime.UtcNow; d.DeletedById = user.Id; d.UpdatedAtUtc = DateTime.UtcNow;
        audit.Add("DrawingDeleted", "Drawing", d.Id, $"Deleted drawing {d.DrawingNumber}", new { d.DrawingNumber });
        await db.SaveChangesAsync(ct);
    }

    private async Task SaveAsync(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { throw ApiException.Conflict("The drawing was changed by someone else or the drawing number already exists. Please refresh and try again."); }
    }
}