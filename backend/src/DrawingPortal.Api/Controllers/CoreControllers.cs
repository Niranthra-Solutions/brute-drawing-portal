using DrawingPortal.Api.Common;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using DrawingPortal.Api.Options;
using DrawingPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using DrawingPortal.Api.Data;

namespace DrawingPortal.Api.Controllers;

public static class Policies { public const string Admin = "AdminOnly"; }

[ApiController, Authorize]
public abstract class ApiBase : ControllerBase { }

[Route("api/lookups")]
public sealed class LookupsController(ILookupService lookups) : ApiBase
{
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Bootstrap(CancellationToken ct)
    {
        var b = await lookups.GetBootstrapAsync(ct);
        Response.Headers[HeaderNames.ETag] = b.ETag;
        Response.Headers[HeaderNames.CacheControl] = "private, no-cache";   // always revalidate (cheap 304), never stale
        if (Request.Headers.IfNoneMatch == b.ETag) return StatusCode(StatusCodes.Status304NotModified);
        return File(b.Json, "application/json");
    }
}

[Route("api/drawings")]
public sealed class DrawingsController(IDrawingService drawings) : ApiBase
{
    [HttpGet("search")] public Task<SearchResultDto> Search([FromQuery] SearchQueryDto query, CancellationToken ct) => drawings.SearchAsync(query, ct);
    [HttpGet("by-number")] public Task<DrawingDetailDto> ByNumber([FromQuery] string number, CancellationToken ct) => drawings.FindByNumberAsync(number, ct);
    [HttpGet("{id}")] public Task<DrawingDetailDto> Get(string id, CancellationToken ct) => drawings.GetAsync(id, ct);

    [HttpGet, Authorize(Policies.Admin)] public Task<PagedResult<DrawingDto>> List([FromQuery] DrawingListQuery query, CancellationToken ct) => drawings.ListAsync(query, ct);
    [HttpPost, Authorize(Policies.Admin)] public Task<DrawingDetailDto> Create(CreateDrawingDto dto, CancellationToken ct) => drawings.CreateAsync(dto, ct);
    [HttpPut("{id}"), Authorize(Policies.Admin)] public Task<DrawingDetailDto> Update(string id, UpdateDrawingDto dto, CancellationToken ct) => drawings.UpdateAsync(id, dto, ct);
    [HttpPost("{id}/revisions"), Authorize(Policies.Admin)] public Task<DrawingDetailDto> AddRevision(string id, AddRevisionDto dto, CancellationToken ct) => drawings.AddRevisionAsync(id, dto, ct);
    [HttpDelete("{id}"), Authorize(Policies.Admin)] public async Task<IActionResult> Delete(string id, CancellationToken ct) { await drawings.DeleteAsync(id, ct); return NoContent(); }
}

[Route("api/requests")]
public sealed class RequestsController(IRequestService requests) : ApiBase
{
    [HttpGet] public Task<PagedResult<RequestListItemDto>> List([FromQuery] RequestListQuery query, CancellationToken ct) => requests.ListAsync(query, ct);
    [HttpGet("stats")] public Task<RequestStatsDto> Stats(CancellationToken ct) => requests.StatsAsync(ct);
    [HttpGet("{id}")] public Task<RequestDetailDto> Get(string id, CancellationToken ct) => requests.GetAsync(id, ct);
    [HttpPost] public Task<RequestDetailDto> Create(CreateRequestDto dto, CancellationToken ct) => requests.CreateAsync(dto, ct);
    [HttpPost("{id}/status"), Authorize(Policies.Admin)] public Task<RequestDetailDto> Status(string id, ChangeStatusDto dto, CancellationToken ct) => requests.ChangeStatusAsync(id, dto, ct);
    [HttpPost("{id}/assign"), Authorize(Policies.Admin)] public Task<RequestDetailDto> Assign(string id, AssignDto dto, CancellationToken ct) => requests.AssignAsync(id, dto.AssigneeId, ct);
    [HttpGet("{id}/comments")] public Task<IReadOnlyList<CommentViewDto>> Comments(string id, CancellationToken ct) => requests.ListCommentsAsync(id, ct);
    [HttpPost("{id}/comments")] public Task<CommentViewDto> AddComment(string id, CommentDto dto, CancellationToken ct) => requests.AddCommentAsync(id, dto.Body, ct);
}

public sealed record FileUsageRow(string FileId, int RevNo, string DrawingId, string Number, string Cat, string Make, string VType, string Model, string Cap, int Volt, int Ah, string Std, string Conn, int L, int W, int H, string Status, int CurRev, bool IsCurrent);
[Route("api/files")]

public sealed class FilesController(IFileStorage storage, AppDbContext db, ICurrentUser me, IOptions<PortalOptions> portal) : ApiBase
{
    private UploadedFileDto ToDto(StoredFile f)
    {
        var baseUrl = string.IsNullOrWhiteSpace(portal.Value.PublicBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : portal.Value.PublicBaseUrl.TrimEnd('/');
        return new UploadedFileDto(f.Id, f.OriginalName, f.SizeBytes, f.ContentType, f.Url, baseUrl + f.Url, f.Sha256);
    }
    private static IFormFile Single(IFormFile? file) => file ?? throw ApiException.BadRequest("Choose a file to upload.", "file");

    /// <summary>Admin library of every uploaded drawing file, with its ready-to-paste URL and where it is used.</summary>
    [HttpGet("drawings"), Authorize(Policies.Admin)]
    public async Task<PagedResult<DrawingFileListItemDto>> ListDrawingFiles([FromQuery] string? q, [FromQuery] bool unusedOnly, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 5, 200);
        var query = db.Files.AsNoTracking().Where(f => f.Kind == FileKind.Drawing);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var t = q.Trim().ToLower();
            query = query.Where(f => f.OriginalName.ToLower().Contains(t) || f.Id.ToLower().Contains(t)
                || db.Revisions.Any(r => r.FileId == f.Id && r.Drawing != null && r.DrawingNumber.ToLower().Contains(t)));
        }
        if (unusedOnly) query = query.Where(f => !db.Revisions.Any(r => r.FileId == f.Id && r.Drawing != null));
        var total = await query.CountAsync(ct);
        var files = await query.OrderByDescending(f => f.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var ids = files.Select(f => f.Id).ToList();
        var uploaders = files.Select(f => f.UploadedById).Where(x => x != null).Distinct().ToList();
        var names = await db.Users.AsNoTracking().Where(u => uploaders.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        var rows = await db.Revisions.AsNoTracking().Where(r => r.FileId != null && ids.Contains(r.FileId) && r.Drawing != null)
            .Select(r => new FileUsageRow(r.FileId!, r.RevisionNo, r.DrawingId, r.Drawing!.DrawingNumber, r.Drawing.Model!.Category!.Name, r.Drawing.Model.Make!.Name, r.Drawing.Model.VehicleType!.Name,
                r.Drawing.Model.ModelName, r.Drawing.Model.Capacity, r.Drawing.VoltageV, r.Drawing.AhValue, r.Drawing.AhStandard, r.Drawing.Connector!.Name,
                r.Drawing.LengthMm, r.Drawing.WidthMm, r.Drawing.HeightMm, r.Drawing.Status.ToString(), r.Drawing.CurrentRevisionNo, r.Drawing.CurrentFileId == r.FileId)).ToListAsync(ct);
        var uses = rows.GroupBy(x => x.FileId).ToDictionary(g => g.Key, g => g.OrderBy(x => x.Number).ThenBy(x => x.RevNo).Take(100).Select(x => new FileUsageDto(x.DrawingId, x.Number, x.Cat, x.Make, x.VType, x.Model, x.Cap, x.Volt,
            DrawingMapper.AhLabel(x.Ah, x.Std), x.Conn, $"{x.L} × {x.W} × {x.H} mm", x.Status, x.RevNo, x.CurRev, x.IsCurrent)).ToList());
        var counts = rows.GroupBy(x => x.FileId).ToDictionary(g => g.Key, g => g.Select(x => x.DrawingId).Distinct().Count());
        var baseUrl = string.IsNullOrWhiteSpace(portal.Value.PublicBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : portal.Value.PublicBaseUrl.TrimEnd('/');
        var items = files.Select(f =>
        {
            uses.TryGetValue(f.Id, out var u); return new DrawingFileListItemDto(f.Id, f.OriginalName, f.Extension, f.SizeBytes, f.ContentType, f.Url, baseUrl + f.Url, f.CreatedAtUtc,
            f.UploadedById != null && names.TryGetValue(f.UploadedById, out var n) ? n : null, counts.GetValueOrDefault(f.Id), u ?? []);
        }).ToList();
        return new PagedResult<DrawingFileListItemDto>(items, total, page, pageSize);
    }

    [HttpPost("drawings"), Authorize(Policies.Admin), EnableRateLimiting("upload"), RequestSizeLimit(60_000_000)]
    public async Task<UploadedFileDto> UploadDrawing(IFormFile? file, CancellationToken ct) => ToDto(await storage.SaveAsync(Single(file), FileKind.Drawing, me.Id, ct));

    [HttpPost("attachments"), EnableRateLimiting("upload"), RequestSizeLimit(15_000_000)]
    public async Task<UploadedFileDto> UploadAttachment(IFormFile? file, CancellationToken ct) => ToDto(await storage.SaveAsync(Single(file), FileKind.RequestAttachment, me.Id, ct));

    [HttpPost("documents"), Authorize(Policies.Admin), EnableRateLimiting("upload"), RequestSizeLimit(210_000_000)]
    public async Task<UploadedFileDto> UploadDocument(IFormFile? file, CancellationToken ct) => ToDto(await storage.SaveAsync(Single(file), FileKind.Document, me.Id, ct));

    [HttpGet("{id}")]
    public async Task<IActionResult> Download(string id, [FromQuery] bool inline, CancellationToken ct)
    {
        var f = await db.Files.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("File not found.");
        if (f.Kind == FileKind.RequestAttachment && !me.IsAdmin && f.UploadedById != me.Id)
        {   // the requestor (who may not be the uploader of a re-used file) can read attachments of their own requests
            var allowed = await db.RequestAttachments.AnyAsync(a => a.FileId == id && db.Requests.Any(r => r.Id == a.RequestId && r.RequestedById == me.Id), ct);
            if (!allowed) throw ApiException.NotFound("File not found.");
        }
        var stream = storage.Open(f);
        var canInline = FileRules.Known.TryGetValue(f.Extension, out var rule) && rule.Inline;
        var disp = new ContentDispositionHeaderValue(inline && canInline ? "inline" : "attachment");
        disp.SetHttpFileName(f.OriginalName);
        Response.Headers[HeaderNames.ContentDisposition] = disp.ToString();
        Response.Headers[HeaderNames.CacheControl] = "private, max-age=300";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(stream, f.ContentType, enableRangeProcessing: true);
    }
}

[Route("api/documents")]
public sealed class DocumentsController(IDocumentService docs) : ApiBase
{
    [HttpGet] public Task<PagedResult<DocumentDto>> List([FromQuery] string? q, [FromQuery] string? category, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => docs.ListAsync(q, category, page, pageSize, ct);
    [HttpGet("categories")] public Task<IReadOnlyList<string>> Categories(CancellationToken ct) => docs.CategoriesAsync(ct);
    [HttpPost, Authorize(Policies.Admin)] public Task<DocumentDto> Create(SaveDocumentDto dto, CancellationToken ct) => docs.CreateAsync(dto, ct);
    [HttpPut("{id}"), Authorize(Policies.Admin)] public Task<DocumentDto> Update(string id, SaveDocumentDto dto, CancellationToken ct) => docs.UpdateAsync(id, dto, ct);
    [HttpDelete("{id}"), Authorize(Policies.Admin)] public async Task<IActionResult> Delete(string id, CancellationToken ct) { await docs.DeleteAsync(id, ct); return NoContent(); }
}

[Route("api/master"), Authorize(Policies.Admin)]
public sealed class MasterController(IMasterDataService master) : ApiBase
{
    [HttpGet("named/{kind}")] public Task<List<NamedItemDto>> ListNamed(string kind, CancellationToken ct) => master.ListNamedAsync(kind, ct);
    [HttpPost("named/{kind}")] public Task<NamedItemDto> CreateNamed(string kind, SaveNamedDto dto, CancellationToken ct) => master.CreateNamedAsync(kind, dto, ct);
    [HttpPut("named/{kind}/{id}")] public Task<NamedItemDto> UpdateNamed(string kind, string id, SaveNamedDto dto, CancellationToken ct) => master.UpdateNamedAsync(kind, id, dto, ct);
    [HttpDelete("named/{kind}/{id}")] public async Task<IActionResult> DeleteNamed(string kind, string id, CancellationToken ct) { await master.DeleteNamedAsync(kind, id, ct); return NoContent(); }

    [HttpGet("models")] public Task<List<ModelDto>> Models(CancellationToken ct) => master.ListModelsAsync(ct);
    [HttpPost("models")] public Task<ModelDto> CreateModel(SaveModelDto dto, CancellationToken ct) => master.SaveModelAsync(null, dto, ct);
    [HttpPut("models/{id}")] public Task<ModelDto> UpdateModel(string id, SaveModelDto dto, CancellationToken ct) => master.SaveModelAsync(id, dto, ct);
    [HttpDelete("models/{id}")] public async Task<IActionResult> DeleteModel(string id, CancellationToken ct) { await master.DeleteModelAsync(id, ct); return NoContent(); }

    [HttpGet("voltages")] public Task<List<VoltageDto>> Voltages(CancellationToken ct) => master.ListVoltagesAsync(ct);
    [HttpPost("voltages")] public Task<VoltageDto> CreateVoltage(SaveVoltageDto dto, CancellationToken ct) => master.SaveVoltageAsync(null, dto, ct);
    [HttpPut("voltages/{id}")] public Task<VoltageDto> UpdateVoltage(string id, SaveVoltageDto dto, CancellationToken ct) => master.SaveVoltageAsync(id, dto, ct);
    [HttpDelete("voltages/{id}")] public async Task<IActionResult> DeleteVoltage(string id, CancellationToken ct) { await master.DeleteVoltageAsync(id, ct); return NoContent(); }

    [HttpGet("ah-ratings")] public Task<List<AhDto>> Ah(CancellationToken ct) => master.ListAhAsync(ct);
    [HttpPost("ah-ratings")] public Task<AhDto> CreateAh(SaveAhDto dto, CancellationToken ct) => master.SaveAhAsync(null, dto, ct);
    [HttpPut("ah-ratings/{id}")] public Task<AhDto> UpdateAh(string id, SaveAhDto dto, CancellationToken ct) => master.SaveAhAsync(id, dto, ct);
    [HttpDelete("ah-ratings/{id}")] public async Task<IActionResult> DeleteAh(string id, CancellationToken ct) { await master.DeleteAhAsync(id, ct); return NoContent(); }
}

[Route("api/settings"), Authorize(Policies.Admin)]
public sealed class SettingsController(ISettingsService settings) : ApiBase
{
    private static SettingsDto ToDto(DrawingSettings s) => new(s.Format.Mask, s.Format.Example, s.ToleranceLengthMm, s.ToleranceWidthMm, s.ToleranceHeightMm);
    [HttpGet] public async Task<SettingsDto> Get(CancellationToken ct) => ToDto(await settings.GetAsync(ct));
    [HttpPut] public async Task<SettingsDto> Update(SaveSettingsDto dto, CancellationToken ct) => ToDto(await settings.UpdateAsync(dto.NumberMask, dto.ToleranceLengthMm, dto.ToleranceWidthMm, dto.ToleranceHeightMm, ct));
    /// <summary>Preview how a mask behaves before saving it.</summary>
    [HttpGet("mask-preview")]
    public IActionResult Preview([FromQuery] string mask, [FromQuery] string? sample)
    {
        if (!DrawingNumberFormat.TryParse(mask, out var f, out var err)) return Ok(new { valid = false, error = err });
        return Ok(new { valid = true, example = f!.Example, sampleMatches = sample is null ? (bool?)null : f.IsMatch(sample) });
    }
}

[Route("api/users"), Authorize(Policies.Admin)]
public sealed class UsersController(IUserService users) : ApiBase
{
    [HttpGet] public Task<PagedResult<UserDto>> List([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => users.ListAsync(q, page, pageSize, ct);
    [HttpGet("admins")] public Task<IReadOnlyList<UserDto>> Admins(CancellationToken ct) => users.AdminsAsync(ct);
    [HttpPost] public Task<UserDto> Create(SaveUserDto dto, CancellationToken ct) => users.CreateAsync(dto, ct);
    [HttpPut("{id}")] public Task<UserDto> Update(string id, SaveUserDto dto, CancellationToken ct) => users.UpdateAsync(id, dto, ct);
}

[Route("api/notifications")]
public sealed class NotificationsController(NotificationService svc) : ApiBase
{
    [HttpGet] public async Task<object> List(CancellationToken ct) { var (items, unread) = await svc.ListAsync(ct); return new { items, unread }; }
    [HttpGet("unread-count")] public async Task<object> Unread(CancellationToken ct) => new { unread = await svc.UnreadCountAsync(ct) };
    [HttpPost("{id}/read")] public async Task<IActionResult> Read(string id, CancellationToken ct) { await svc.MarkReadAsync(id, ct); return NoContent(); }
    [HttpPost("read-all")] public async Task<IActionResult> ReadAll(CancellationToken ct) { await svc.MarkAllReadAsync(ct); return NoContent(); }
}

[Route("api/audit"), Authorize(Policies.Admin)]
public sealed class AuditController(AuditQueryService svc) : ApiBase
{
    [HttpGet] public Task<PagedResult<AuditDto>> List([FromQuery] AuditQuery query, CancellationToken ct) => svc.ListAsync(query, ct);
}

[Route("api/dashboard")]
public sealed class DashboardController(DashboardService svc) : ApiBase
{
    [HttpGet] public Task<DashboardDto> Get(CancellationToken ct) => svc.GetAsync(ct);
}

[Route("api/bulk-import"), Authorize(Policies.Admin)]
public sealed class BulkImportController(IBulkImportService bulk) : ApiBase
{
    [HttpGet("template")]
    public IActionResult Template() =>
        File(bulk.BuildTemplate(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "drawing-import-template.xlsx");

    [HttpPost, EnableRateLimiting("upload"), RequestSizeLimit(15_000_000)]
    public Task<BulkJobDto> Start(IFormFile? file, [FromForm] bool skipDuplicates = true, [FromForm] bool autoCreateMaster = false, CancellationToken ct = default) =>
        bulk.StartAsync(file ?? throw ApiException.BadRequest("Choose an Excel file.", "file"), skipDuplicates, autoCreateMaster, ct);

    [HttpGet] public Task<IReadOnlyList<BulkJobDto>> List(CancellationToken ct) => bulk.ListAsync(ct);
    [HttpGet("{id}")] public Task<BulkJobDto> Get(string id, CancellationToken ct) => bulk.GetAsync(id, ct);
    [HttpGet("{id}/errors")] public Task<IReadOnlyList<BulkErrorDto>> Errors(string id, CancellationToken ct) => bulk.ErrorsAsync(id, ct);

    [HttpGet("{id}/errors.csv")]
    public async Task<IActionResult> ErrorsCsv(string id, CancellationToken ct)
    {
        var errors = await bulk.ErrorsAsync(id, ct);
        var sb = new System.Text.StringBuilder("Row,DrawingNumber,Error\r\n");
        foreach (var e in errors) sb.Append(e.RowNumber).Append(',').Append(Csv(e.DrawingNumber)).Append(',').Append(Csv(e.Message)).Append("\r\n");
        return File(System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString())).ToArray(), "text/csv", $"import-{id}-errors.csv");
        static string Csv(string? s) => "\"" + Text.SafeCell(s).Replace("\"", "\"\"") + "\"";   // formula-injection safe
    }
}