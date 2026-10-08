using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace DrawingPortal.Api.Services;

// ============================================================ USERS
public interface IUserService
{
    Task<PagedResult<UserDto>> ListAsync(string? q, int page, int size, CancellationToken ct);
    Task<UserDto> CreateAsync(SaveUserDto dto, CancellationToken ct);
    Task<UserDto> UpdateAsync(string id, SaveUserDto dto, CancellationToken ct);
    Task<IReadOnlyList<UserDto>> AdminsAsync(CancellationToken ct);
}

public sealed class UserService(AppDbContext db, IAuditService audit, ICurrentUser me, INotifier notifier) : IUserService
{
    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.FullName, u.Department, u.Role.ToString(), u.IsActive, u.LastLoginAtUtc, u.CreatedAtUtc);

    public async Task<PagedResult<UserDto>> ListAsync(string? q, int page, int size, CancellationToken ct)
    {
        (page, size) = PagingExtensions.Normalize(page, size);
        var qy = db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q)) { var t = q.Trim(); qy = qy.Where(u => u.Email.Contains(t) || u.FullName.Contains(t) || (u.Department != null && u.Department.Contains(t))); }
        var total = await qy.CountAsync(ct);
        var items = await qy.OrderBy(u => u.FullName).ThenBy(u => u.Id).Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new PagedResult<UserDto>(items.Select(ToDto).ToList(), total, page, size);
    }

    public async Task<IReadOnlyList<UserDto>> AdminsAsync(CancellationToken ct) =>
        (await db.Users.AsNoTracking().Where(u => u.IsActive && u.Role == UserRole.Admin).OrderBy(u => u.FullName).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<UserDto> CreateAsync(SaveUserDto dto, CancellationToken ct)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, ct)) throw ApiException.Conflict("A user with this e-mail address already exists.");
        var u = new User { Email = email, FullName = Text.Clean(dto.FullName, 120), Department = Text.NullIfEmpty(Text.Clean(dto.Department, 120)), Role = dto.Role, IsActive = dto.IsActive };
        db.Users.Add(u);
        audit.Add("UserCreated", "User", u.Id, $"User {email} created with role {u.Role}");
        notifier.Email(u.Email, u.FullName, "You have been given access to the Drawing Portal",
            EmailTemplates.Build("Welcome to the Drawing Portal", $"You now have {u.Role} access. Sign in with your e-mail address - a one-time code will be sent to you.", null, "Open the portal", notifier.Link("/login")), "Welcome");
        await db.SaveChangesAsync(ct);
        return ToDto(u);
    }

    public async Task<UserDto> UpdateAsync(string id, SaveUserDto dto, CancellationToken ct)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("User not found.");
        var email = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email && x.Id != id, ct)) throw ApiException.Conflict("Another user already has this e-mail address.");
        var losingAdmin = u.Role == UserRole.Admin && u.IsActive && (dto.Role != UserRole.Admin || !dto.IsActive);
        if (losingAdmin)
        {
            if (u.Id == me.Id) throw ApiException.BadRequest("You cannot remove your own admin access.");
            if (await db.Users.CountAsync(x => x.Role == UserRole.Admin && x.IsActive && x.Id != id, ct) == 0) throw ApiException.BadRequest("At least one active admin is required.");
        }
        var changed = u.Role != dto.Role || u.IsActive != dto.IsActive;
        u.Email = email; u.FullName = Text.Clean(dto.FullName, 120); u.Department = Text.NullIfEmpty(Text.Clean(dto.Department, 120)); u.Role = dto.Role; u.IsActive = dto.IsActive;
        if (!dto.IsActive) foreach (var t in await db.RefreshTokens.Where(t => t.UserId == id && t.RevokedAtUtc == null).ToListAsync(ct)) t.RevokedAtUtc = DateTime.UtcNow;
        audit.Add(changed ? "UserAccessChanged" : "UserUpdated", "User", id, $"User {email}: role {u.Role}, {(u.IsActive ? "active" : "deactivated")}");
        await db.SaveChangesAsync(ct);
        return ToDto(u);
    }
}

// ============================================================ DOCUMENTS
public interface IDocumentService
{
    Task<PagedResult<DocumentDto>> ListAsync(string? q, string? category, int page, int size, CancellationToken ct);
    Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct);
    Task<DocumentDto> CreateAsync(SaveDocumentDto dto, CancellationToken ct);
    Task<DocumentDto> UpdateAsync(string id, SaveDocumentDto dto, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
}

public sealed class DocumentService(AppDbContext db, ICurrentUser me, IAuditService audit) : IDocumentService
{
    public async Task<PagedResult<DocumentDto>> ListAsync(string? q, string? category, int page, int size, CancellationToken ct)
    {
        (page, size) = PagingExtensions.Normalize(page, size);
        var qy = db.Documents.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q)) { var t = q.Trim(); qy = qy.Where(d => d.Title.Contains(t) || (d.Description != null && d.Description.Contains(t)) || d.File!.OriginalName.Contains(t)); }
        if (!string.IsNullOrWhiteSpace(category)) qy = qy.Where(d => d.Category == category);
        var total = await qy.CountAsync(ct);
        var rows = await qy.OrderByDescending(d => d.UpdatedAtUtc).ThenBy(d => d.Id).Skip((page - 1) * size).Take(size)
            .Select(d => new { d.Id, d.Title, d.Category, d.Description, d.FileId, Name = d.File!.OriginalName, d.File.Extension, d.File.SizeBytes, d.UpdatedAtUtc }).ToListAsync(ct);
        return new PagedResult<DocumentDto>(rows.Select(d => new DocumentDto(d.Id, d.Title, d.Category, d.Description, d.FileId, d.Name, d.Extension, d.SizeBytes, d.UpdatedAtUtc, DrawingMapper.IsPreviewable(d.Name))).ToList(), total, page, size);
    }

    public async Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct) =>
        await db.Documents.AsNoTracking().Select(d => d.Category).Distinct().OrderBy(c => c).ToListAsync(ct);

    private async Task<DocumentDto> Load(string id, CancellationToken ct)
    {
        var d = await db.Documents.AsNoTracking().Include(x => x.File).FirstAsync(x => x.Id == id, ct);
        return new DocumentDto(d.Id, d.Title, d.Category, d.Description, d.FileId, d.File!.OriginalName, d.File.Extension, d.File.SizeBytes, d.UpdatedAtUtc, DrawingMapper.IsPreviewable(d.File.OriginalName));
    }

    public async Task<DocumentDto> CreateAsync(SaveDocumentDto dto, CancellationToken ct)
    {
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == dto.FileId && f.Kind == FileKind.Document, ct) ?? throw ApiException.BadRequest("Upload the document file first.", "fileId");
        var d = new PortalDocument { Title = Text.Clean(dto.Title, 200), Category = Text.Clean(dto.Category, 80), Description = Text.NullIfEmpty(Text.CleanMultiline(dto.Description, 1000)), FileId = file.Id, UploadedById = me.Id };
        db.Documents.Add(d);
        audit.Add("DocumentCreated", "Document", d.Id, $"Document '{d.Title}' added");
        await db.SaveChangesAsync(ct);
        return await Load(d.Id, ct);
    }

    public async Task<DocumentDto> UpdateAsync(string id, SaveDocumentDto dto, CancellationToken ct)
    {
        var d = await db.Documents.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Document not found.");
        d.Title = Text.Clean(dto.Title, 200); d.Category = Text.Clean(dto.Category, 80); d.Description = Text.NullIfEmpty(Text.CleanMultiline(dto.Description, 1000)); d.UpdatedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrEmpty(dto.FileId) && dto.FileId != d.FileId)
            d.FileId = (await db.Files.FirstOrDefaultAsync(f => f.Id == dto.FileId && f.Kind == FileKind.Document, ct) ?? throw ApiException.BadRequest("Invalid file.", "fileId")).Id;
        audit.Add("DocumentUpdated", "Document", id, $"Document '{d.Title}' updated");
        await db.SaveChangesAsync(ct);
        return await Load(id, ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var d = await db.Documents.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Document not found.");
        d.IsDeleted = true; d.UpdatedAtUtc = DateTime.UtcNow;
        audit.Add("DocumentDeleted", "Document", id, $"Document '{d.Title}' deleted");
        await db.SaveChangesAsync(ct);
    }
}

// ============================================================ NOTIFICATIONS / AUDIT / DASHBOARD
public sealed class NotificationService(AppDbContext db, ICurrentUser me)
{
    public async Task<(IReadOnlyList<NotificationDto> Items, int Unread)> ListAsync(CancellationToken ct)
    {
        var items = await db.Notifications.AsNoTracking().Where(n => n.UserId == me.Id).OrderByDescending(n => n.CreatedAtUtc).Take(30)
            .Select(n => new NotificationDto(n.Id, n.Title, n.Message, n.LinkPath, n.IsRead, n.CreatedAtUtc)).ToListAsync(ct);
        var unread = await db.Notifications.CountAsync(n => n.UserId == me.Id && !n.IsRead, ct);
        return (items, unread);
    }
    public Task<int> UnreadCountAsync(CancellationToken ct) => db.Notifications.CountAsync(n => n.UserId == me.Id && !n.IsRead, ct);
    public Task MarkReadAsync(string id, CancellationToken ct) => db.Notifications.Where(n => n.Id == id && n.UserId == me.Id && !n.IsRead).ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
    public Task MarkAllReadAsync(CancellationToken ct) => db.Notifications.Where(n => n.UserId == me.Id && !n.IsRead).ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
}

public sealed class AuditQueryService(AppDbContext db)
{
    public async Task<PagedResult<AuditDto>> ListAsync(AuditQuery q, CancellationToken ct)
    {
        var (page, size) = PagingExtensions.Normalize(q.Page, q.PageSize, 200);
        var qy = db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Q)) { var t = q.Q.Trim(); qy = qy.Where(a => a.Summary.Contains(t) || a.ActorEmail.Contains(t) || (a.EntityId != null && a.EntityId.Contains(t))); }
        if (!string.IsNullOrWhiteSpace(q.EntityType)) qy = qy.Where(a => a.EntityType == q.EntityType);
        if (!string.IsNullOrWhiteSpace(q.Action)) qy = qy.Where(a => a.Action == q.Action);
        if (q.From is not null) qy = qy.Where(a => a.CreatedAtUtc >= q.From);
        if (q.To is not null) qy = qy.Where(a => a.CreatedAtUtc < q.To.Value.AddDays(1));
        var total = await qy.CountAsync(ct);
        var rows = await qy.OrderByDescending(a => a.CreatedAtUtc).ThenByDescending(a => a.Id).Skip((page - 1) * size).Take(size)
            .Select(a => new AuditDto(a.Id, a.CreatedAtUtc, a.ActorEmail, a.Action, a.EntityType, a.EntityId, a.Summary, a.DetailsJson, a.IpAddress)).ToListAsync(ct);
        return new PagedResult<AuditDto>(rows, total, page, size);
    }
}

public sealed class DashboardService(AppDbContext db, IRequestService requests, ICurrentUser me)
{
    public async Task<DashboardDto> GetAsync(CancellationToken ct)
    {
        var stats = await requests.StatsAsync(ct);
        var recent = (await requests.ListAsync(new RequestListQuery { PageSize = 6 }, ct)).Items;
        int total = 0, active = 0, archived = 0, week = 0;
        var turnaround = new List<WeeklyPointDto>(); var activity = new List<AuditDto>();
        if (me.IsAdmin)
        {
            total = await db.Drawings.CountAsync(ct);
            active = await db.Drawings.CountAsync(d => d.Status == DrawingStatus.Active, ct);
            archived = total - active;
            var since = DateTime.UtcNow.AddDays(-7);
            week = await db.Drawings.CountAsync(d => d.CreatedAtUtc >= since, ct);
            var from = DateTime.UtcNow.Date.AddDays(-34);
            var closed = await db.Requests.AsNoTracking().Where(r => r.Status == RequestStatus.Completed && r.ClosedAtUtc >= from).Select(r => new { r.SubmittedAtUtc, r.ClosedAtUtc }).ToListAsync(ct);
            for (var i = 4; i >= 0; i--)
            {
                var s = DateTime.UtcNow.Date.AddDays(-7 * (i + 1) + 1); var e = s.AddDays(7);
                var inWeek = closed.Where(c => c.ClosedAtUtc >= s && c.ClosedAtUtc < e).ToList();
                turnaround.Add(new WeeklyPointDto($"W{5 - i}", inWeek.Count == 0 ? 0 : Math.Round(inWeek.Average(c => (c.ClosedAtUtc!.Value - c.SubmittedAtUtc).TotalDays), 1), inWeek.Count));
            }
            activity = await db.AuditLogs.AsNoTracking().OrderByDescending(a => a.CreatedAtUtc).Take(8)
                .Select(a => new AuditDto(a.Id, a.CreatedAtUtc, a.ActorEmail, a.Action, a.EntityType, a.EntityId, a.Summary, null, null)).ToListAsync(ct);
        }
        else
        {
            total = active = await db.Drawings.CountAsync(d => d.Status == DrawingStatus.Active, ct);
            week = await db.Drawings.CountAsync(d => d.Status == DrawingStatus.Active && d.CreatedAtUtc >= DateTime.UtcNow.AddDays(-7), ct);
        }
        return new DashboardDto(total, active, archived, week, stats, recent, turnaround, activity);
    }
}
