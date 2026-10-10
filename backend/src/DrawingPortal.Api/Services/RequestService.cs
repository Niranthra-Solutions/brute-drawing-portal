using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using DrawingPortal.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Services;

public interface IRequestWorkflow
{
    /// <summary>Marks the request Completed when an admin uploads the resulting drawing/revision. Stages changes only (caller saves).</summary>
    Task CompleteWithDrawingAsync(string requestId, Drawing drawing, CancellationToken ct);
}

public interface IRequestService : IRequestWorkflow
{
    Task<RequestDetailDto> CreateAsync(CreateRequestDto dto, CancellationToken ct);
    Task<PagedResult<RequestListItemDto>> ListAsync(RequestListQuery q, CancellationToken ct);
    Task<RequestDetailDto> GetAsync(string id, CancellationToken ct);
    Task<RequestStatsDto> StatsAsync(CancellationToken ct);
    Task<RequestDetailDto> ChangeStatusAsync(string id, ChangeStatusDto dto, CancellationToken ct);
    Task<RequestDetailDto> AssignAsync(string id, string assigneeId, CancellationToken ct);
    Task<IReadOnlyList<CommentViewDto>> ListCommentsAsync(string id, CancellationToken ct);
    Task<CommentViewDto> AddCommentAsync(string id, string body, CancellationToken ct);
}

public sealed class RequestService(AppDbContext db, ICurrentUser user, INotifier notifier, IAuditService audit, IOptions<PortalOptions> portal) : IRequestService
{
    private static bool IsClosed(RequestStatus s) => s is RequestStatus.Completed or RequestStatus.Rejected;
    private string Url(DrawingRequest r) => notifier.Link("/requests/" + r.Id);
    private static string Human(RequestStatus s) => s switch { RequestStatus.InReview => "In review", RequestStatus.InProgress => "In progress", _ => s.ToString() };

    // ====================================================================== CREATE
    private async Task<string> NextTicketAsync(string prefix, CancellationToken ct)
    {
        var year = DateTime.UtcNow.Year;
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var c = await db.TicketCounters.FirstOrDefaultAsync(x => x.Prefix == prefix && x.Year == year, ct);
            if (c is null) { c = new TicketCounter { Prefix = prefix, Year = year }; db.TicketCounters.Add(c); }
            c.LastValue++; c.Version++;
            try { await db.SaveChangesAsync(ct); return $"{prefix}-{year}-{c.LastValue:000000}"; }
            catch (DbUpdateException ex)
            {   // optimistic-concurrency / first-insert race: discard and retry with fresh data
                foreach (var e in ex.Entries) e.State = EntityState.Detached;
                await Task.Delay(Random.Shared.Next(5, 40), ct);
            }
        }
        throw ApiException.Conflict("Could not allocate a ticket number. Please try again.");
    }

    public async Task<RequestDetailDto> CreateAsync(CreateRequestDto dto, CancellationToken ct)
    {
        var errs = new FieldErrors();
        Drawing? related = null;
        if (!string.IsNullOrEmpty(dto.RelatedDrawingId))
        {
            related = await db.Drawings.Include(d => d.Model!.Make).FirstOrDefaultAsync(d => d.Id == dto.RelatedDrawingId, ct);
            if (related is null) errs.Add("relatedDrawingId", "The referenced drawing no longer exists.");
        }
        string R(string? s, int max) => Text.Clean(s, max);
        void Dim(string f, int? v, string label, bool required) { if (v is null) { if (required) errs.Add(f, $"{label} is required."); } else if (v is < 100 or > 9999) errs.Add(f, $"{label} must be a number with 3 or 4 digits."); }

        if (dto.Type == RequestType.New)
        {
            foreach (var (f, v, label) in new[] { ("categoryName", dto.CategoryName, "Vehicle category"), ("vehicleTypeName", dto.VehicleTypeName, "Vehicle type"), ("makeName", dto.MakeName, "Vehicle make"),
                         ("modelName", dto.ModelName, "Model"), ("capacity", dto.Capacity, "Vehicle capacity"), ("connectorName", dto.ConnectorName, "End connector type") })
                if (string.IsNullOrWhiteSpace(v)) errs.Add(f, $"{label} is required.");
            if (dto.VoltageV is null or < 1) errs.Add("voltageV", "Voltage is required.");
            if (dto.AhValue is null or < 1) errs.Add("ahValue", "Ah rating is required.");
            Dim("lengthMm", dto.LengthMm, "Length", true); Dim("widthMm", dto.WidthMm, "Width", true); Dim("heightMm", dto.HeightMm, "Height", true);
        }
        else
        {
            if (related is null) errs.Add("relatedDrawingId", "Select the drawing that needs to be modified.");
            Dim("lengthMm", dto.LengthMm, "Length", false); Dim("widthMm", dto.WidthMm, "Width", false); Dim("heightMm", dto.HeightMm, "Height", false);
            // required change, reason and reference file are optional for modification requests
        }

        var attachIds = dto.AttachmentFileIds.Distinct().ToList();
        if (attachIds.Count > 5) errs.Add("attachmentFileIds", "You can attach up to 5 files.");
        var files = attachIds.Count == 0 ? new List<StoredFile>() : await db.Files.Where(f => attachIds.Contains(f.Id) && f.Kind == FileKind.RequestAttachment && f.UploadedById == user.Id).ToListAsync(ct);
        if (files.Count != attachIds.Count) errs.Add("attachmentFileIds", "One or more attachments are invalid. Please upload them again.");
        errs.ThrowIfAny();

        var ticket = await NextTicketAsync(dto.Type == RequestType.New ? "DR" : "DM", ct);
        var title = dto.Type == RequestType.New
            ? Text.Truncate($"{R(dto.MakeName, 60)} {R(dto.ModelName, 60)} {R(dto.Capacity, 20)} - {dto.VoltageV}V {dto.AhValue}Ah tray".Trim(), 200)
            : Text.Truncate($"Modify {related!.DrawingNumber}" + (string.IsNullOrWhiteSpace(dto.ChangeType) ? "" : $" - {R(dto.ChangeType, 40)}"), 200);
        var r = new DrawingRequest
        {
            TicketNo = ticket, Type = dto.Type, Priority = dto.Priority, RequestedById = user.Id!, Title = title, RelatedDrawingId = related?.Id,
            CategoryName = Text.NullIfEmpty(R(dto.CategoryName, 60)), VehicleTypeName = Text.NullIfEmpty(R(dto.VehicleTypeName, 100)), MakeName = Text.NullIfEmpty(R(dto.MakeName, 100)),
            ModelName = Text.NullIfEmpty(R(dto.ModelName, 120)), Capacity = Text.NullIfEmpty(R(dto.Capacity, 40)), VoltageV = dto.VoltageV, AhValue = dto.AhValue,
            AhStandard = Text.NullIfEmpty(R(dto.AhStandard, 20))?.ToUpperInvariant(), LengthMm = dto.LengthMm, WidthMm = dto.WidthMm, HeightMm = dto.HeightMm,
            ConnectorName = Text.NullIfEmpty(R(dto.ConnectorName, 100)), ChangeType = Text.NullIfEmpty(R(dto.ChangeType, 40)),
            TargetDateUtc = dto.TargetDate?.ToUniversalTime(), Description = Text.CleanMultiline(dto.Description, 4000), Reason = Text.NullIfEmpty(Text.CleanMultiline(dto.Reason, 2000)),
        };
        db.Requests.Add(r);
        foreach (var f in files) db.RequestAttachments.Add(new RequestAttachment { RequestId = r.Id, FileId = f.Id });
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, ActorId = user.Id, Action = "Submitted", ToStatus = RequestStatus.Submitted.ToString(), Note = "Request submitted." });
        audit.Add("RequestSubmitted", "Request", r.Id, $"{ticket} submitted by {user.Email}", new { r.Type, r.Priority, related = related?.DrawingNumber });

        // Notify every active admin (e-mail + in-app) - atomically with the request itself (outbox).
        var rows = new List<(string, string)>
        {
            ("Ticket", ticket), ("Type", dto.Type == RequestType.New ? "New drawing request" : "Drawing modification request"), ("Priority", r.Priority.ToString()), ("Requested by", $"{user.Name} ({user.Email})"),
            ("Existing / base drawing", related is null ? "" : $"{related.DrawingNumber} - {related.Model?.Make?.Name} {related.Model?.ModelName}"),
            ("Vehicle", string.Join(" / ", new[] { r.CategoryName, r.MakeName, r.VehicleTypeName, r.ModelName, r.Capacity }.Where(x => !string.IsNullOrEmpty(x)))),
            ("Battery", r.VoltageV is null ? "" : $"{r.VoltageV} V / {DrawingMapper.AhLabel(r.AhValue ?? 0, r.AhStandard ?? "")} Ah"),
            ("Tray dimensions (mm)", r.LengthMm is null ? "" : $"{r.LengthMm} x {r.WidthMm} x {r.HeightMm}"), ("End connector", r.ConnectorName ?? ""), ("Change type", r.ChangeType ?? ""),
            ("Attachments", files.Count == 0 ? "" : string.Join(", ", files.Select(f => f.OriginalName))),
        };
        var subject = $"[Drawing Portal] {(dto.Type == RequestType.New ? "New drawing request" : "Modification request")} {ticket} from {user.Name}";
        var body = EmailTemplates.Build(dto.Type == RequestType.New ? "New drawing request" : "Drawing modification request",
            $"{user.Name} has raised {ticket}. Please review and respond.", rows, "Open request", Url(r), r.Description);
        foreach (var a in await notifier.ActiveAdminsAsync(ct))
        {
            notifier.Email(a.Email, a.FullName, subject, body, "RequestSubmitted");
            notifier.InApp(a.Id, $"New {(dto.Type == RequestType.New ? "drawing" : "modification")} request {ticket}", $"{user.Name}: {title}", "/requests/" + r.Id);
        }
        await db.SaveChangesAsync(ct);
        return await GetAsync(r.Id, ct);
    }

    // ====================================================================== READ
    private IQueryable<DrawingRequest> Visible() => user.IsAdmin ? db.Requests.AsNoTracking() : db.Requests.AsNoTracking().Where(r => r.RequestedById == user.Id);

    public async Task<PagedResult<RequestListItemDto>> ListAsync(RequestListQuery q, CancellationToken ct)
    {
        var (page, size) = PagingExtensions.Normalize(q.Page, q.PageSize);
        var qy = Visible();
        if (q.Type is not null) qy = qy.Where(r => r.Type == q.Type);
        if (q.Status is not null) qy = qy.Where(r => r.Status == q.Status);
        if (q.Priority is not null) qy = qy.Where(r => r.Priority == q.Priority);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var t = q.Q.Trim();
            qy = qy.Where(r => r.TicketNo.Contains(t) || r.Title.Contains(t) || r.RequestedBy!.FullName.Contains(t) || (r.RelatedDrawing != null && r.RelatedDrawing.DrawingNumber.Contains(t)));
        }
        var desc = !string.Equals(q.Dir, "asc", StringComparison.OrdinalIgnoreCase);
        IOrderedQueryable<DrawingRequest> ordered = (q.Sort?.ToLowerInvariant()) switch
        {
            "ticket" => desc ? qy.OrderByDescending(r => r.TicketNo) : qy.OrderBy(r => r.TicketNo),
            "status" => desc ? qy.OrderByDescending(r => r.Status) : qy.OrderBy(r => r.Status),
            "priority" => desc ? qy.OrderByDescending(r => r.Priority) : qy.OrderBy(r => r.Priority),
            "updated" => desc ? qy.OrderByDescending(r => r.UpdatedAtUtc) : qy.OrderBy(r => r.UpdatedAtUtc),
            _ => desc ? qy.OrderByDescending(r => r.SubmittedAtUtc) : qy.OrderBy(r => r.SubmittedAtUtc),
        };
        var total = await qy.CountAsync(ct);
        var rows = await ordered.ThenBy(r => r.Id).Skip((page - 1) * size).Take(size).Select(r => new
        {
            r.Id, r.TicketNo, r.Type, r.Status, r.Priority, r.Title, Name = r.RequestedBy!.FullName, Email = r.RequestedBy.Email,
            Assignee = r.AssignedTo == null ? null : r.AssignedTo.FullName, Drawing = r.RelatedDrawing == null ? null : r.RelatedDrawing.DrawingNumber, r.SubmittedAtUtc, r.UpdatedAtUtc
        }).ToListAsync(ct);
        return new PagedResult<RequestListItemDto>(rows.Select(r => new RequestListItemDto(r.Id, r.TicketNo, r.Type.ToString(), r.Status.ToString(), r.Priority.ToString(), r.Title, r.Name, r.Email, r.Assignee, r.Drawing, r.SubmittedAtUtc, r.UpdatedAtUtc)).ToList(), total, page, size);
    }

    public async Task<RequestDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var r = await Visible().Include(x => x.RequestedBy).Include(x => x.AssignedTo).Include(x => x.ResultDrawing)
            .Include(x => x.Attachments).ThenInclude(a => a.File).Include(x => x.Events).ThenInclude(e => e.Actor)
            .AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw ApiException.NotFound("Request not found.");
        DrawingDto? related = null;
        if (r.RelatedDrawingId is not null)
        {
            var row = await db.Drawings.AsNoTracking().Where(d => d.Id == r.RelatedDrawingId).Select(DrawingMapper.Row).FirstOrDefaultAsync(ct);
            if (row is not null) related = DrawingMapper.ToDto(row);
        }
        DrawingDto? result = null;
        if (r.ResultDrawingId is not null)
        {
            var row = await db.Drawings.AsNoTracking().Where(d => d.Id == r.ResultDrawingId).Select(DrawingMapper.Row).FirstOrDefaultAsync(ct);
            if (row is not null) result = DrawingMapper.ToDto(row);
        }
        return new RequestDetailDto(r.Id, r.TicketNo, r.Type.ToString(), r.Status.ToString(), r.Priority.ToString(), r.Title, r.RequestedById, r.RequestedBy!.FullName, r.RequestedBy.Email,
            r.AssignedToId, r.AssignedTo?.FullName, related, r.CategoryName, r.VehicleTypeName, r.MakeName, r.ModelName, r.Capacity, r.VoltageV,
            r.AhValue is null ? null : DrawingMapper.AhLabel(r.AhValue.Value, r.AhStandard ?? ""), r.LengthMm, r.WidthMm, r.HeightMm, r.ConnectorName, r.ChangeType, r.TargetDateUtc,
            r.Description, r.Reason, r.SubmittedAtUtc, r.UpdatedAtUtc, r.ClosedAtUtc, r.ClosureNote, r.ResultDrawingId, r.ResultDrawing?.DrawingNumber, result,
            r.Attachments.Where(a => a.File != null).Select(a => new AttachmentDto(a.FileId, a.File!.OriginalName, a.File.SizeBytes, a.File.Url, DrawingMapper.IsPreviewable(a.File.OriginalName))).ToList(),
            r.Events.OrderBy(e => e.CreatedAtUtc).Select(e => new RequestEventDto(e.Id, e.Action, e.FromStatus, e.ToStatus, e.Note, e.Actor?.FullName, e.CreatedAtUtc)).ToList(),
            user.IsAdmin && !IsClosed(r.Status), IsClosed(r.Status));
    }

    public async Task<RequestStatsDto> StatsAsync(CancellationToken ct)
    {
        var rows = await Visible().Select(r => new { r.Status, r.Priority, r.SubmittedAtUtc, r.ClosedAtUtc }).ToListAsync(ct);
        var since = DateTime.UtcNow.AddDays(-30);
        var closed = rows.Where(r => r.Status == RequestStatus.Completed && r.ClosedAtUtc != null).ToList();
        var avg = closed.Count == 0 ? 0 : Math.Round(closed.Average(r => (r.ClosedAtUtc!.Value - r.SubmittedAtUtc).TotalDays), 1);
        return new RequestStatsDto(rows.Count, rows.Count(r => r.Status is RequestStatus.Submitted or RequestStatus.InReview or RequestStatus.Assigned),
            rows.Count(r => r.Status == RequestStatus.InProgress), rows.Count(r => r.Status == RequestStatus.Completed), rows.Count(r => r.Status == RequestStatus.Rejected),
            rows.Count(r => r.Priority == RequestPriority.Critical && !IsClosed(r.Status)), closed.Count(r => r.ClosedAtUtc >= since), avg);
    }

    // ====================================================================== STATUS / ASSIGN
    private async Task<DrawingRequest> LoadForUpdateAsync(string id, CancellationToken ct) =>
        await db.Requests.Include(r => r.RequestedBy).FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw ApiException.NotFound("Request not found.");

    private void NotifyRequestor(DrawingRequest r, string subject, string heading, string intro, string? note, string category, IEnumerable<(string, string)>? rows = null)
    {
        var body = EmailTemplates.Build(heading, intro, rows ?? [("Ticket", r.TicketNo), ("Request", r.Title)], "View request", Url(r), note);
        notifier.Email(r.RequestedBy!.Email, r.RequestedBy.FullName, subject, body, category);
        notifier.InApp(r.RequestedById, heading, $"{r.TicketNo}: {intro}", "/requests/" + r.Id);
    }

    public async Task<RequestDetailDto> ChangeStatusAsync(string id, ChangeStatusDto dto, CancellationToken ct)
    {
        var r = await LoadForUpdateAsync(id, ct);
        if (IsClosed(r.Status)) throw ApiException.Conflict("This request is already closed.");
        if (dto.Status == r.Status) throw ApiException.BadRequest("The request already has this status.", "status");
        var note = Text.NullIfEmpty(Text.CleanMultiline(dto.Note, 2000));
        var from = r.Status;

        switch (dto.Status)
        {
            case RequestStatus.Submitted: throw ApiException.BadRequest("A request cannot move back to Submitted.", "status");
            case RequestStatus.Rejected:
                if (note is null) throw ApiException.BadRequest("Please give a reason for rejecting the request.", "note");
                r.ClosedAtUtc = DateTime.UtcNow; r.ClosureNote = note; break;
            case RequestStatus.Completed:
                var num = DrawingNumberFormat.Normalize(dto.ResultDrawingNumber);
                var drawing = string.IsNullOrEmpty(num) ? null : await db.Drawings.FirstOrDefaultAsync(d => d.DrawingNumber == num, ct);
                if (drawing is null) throw ApiException.BadRequest("To close without uploading, enter the number of an existing drawing that satisfies this request. Otherwise upload the new drawing from the upload page, which closes the request automatically.", "resultDrawingNumber");
                r.ResultDrawingId = drawing.Id; r.ClosedAtUtc = DateTime.UtcNow; r.ClosureNote = note ?? "Satisfied by an existing drawing."; break;
            case RequestStatus.Assigned:
                r.AssignedToId ??= user.Id; break;
            case RequestStatus.InProgress:
                r.AssignedToId ??= user.Id; break;
        }
        r.Status = dto.Status; r.UpdatedAtUtc = DateTime.UtcNow;
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, ActorId = user.Id, Action = "StatusChanged", FromStatus = from.ToString(), ToStatus = dto.Status.ToString(), Note = note });
        audit.Add("RequestStatusChanged", "Request", r.Id, $"{r.TicketNo}: {from} -> {dto.Status}", new { from, to = dto.Status, note });

        var human = Human(dto.Status);
        NotifyRequestor(r, $"[Drawing Portal] {r.TicketNo} is now {human}", $"Request {human}",
            dto.Status == RequestStatus.Completed ? $"Your request has been completed with drawing {DrawingNumberFormat.Normalize(dto.ResultDrawingNumber)}." : $"The status of your request {r.TicketNo} changed from {Human(from)} to {human}.",
            note, "RequestStatus");
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<RequestDetailDto> AssignAsync(string id, string assigneeId, CancellationToken ct)
    {
        var r = await LoadForUpdateAsync(id, ct);
        if (IsClosed(r.Status)) throw ApiException.Conflict("This request is already closed.");
        var assignee = await db.Users.FirstOrDefaultAsync(u => u.Id == assigneeId && u.IsActive && u.Role == UserRole.Admin, ct) ?? throw ApiException.BadRequest("Select an active admin user.", "assigneeId");
        var from = r.Status;
        r.AssignedToId = assignee.Id; r.UpdatedAtUtc = DateTime.UtcNow;
        if (r.Status is RequestStatus.Submitted or RequestStatus.InReview) r.Status = RequestStatus.Assigned;
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, ActorId = user.Id, Action = "Assigned", FromStatus = from.ToString(), ToStatus = r.Status.ToString(), Note = $"Assigned to {assignee.FullName}" });
        audit.Add("RequestAssigned", "Request", r.Id, $"{r.TicketNo} assigned to {assignee.Email}");
        NotifyRequestor(r, $"[Drawing Portal] {r.TicketNo} has been assigned", "Request assigned", $"{assignee.FullName} is now working on your request {r.TicketNo}.", null, "RequestStatus");
        if (assignee.Id != user.Id) notifier.InApp(assignee.Id, $"Request {r.TicketNo} assigned to you", r.Title, "/requests/" + r.Id);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Called by DrawingService when the admin uploads the drawing for this request - closes the ticket automatically (BRD 3.1 / 4.1).</summary>
    public async Task CompleteWithDrawingAsync(string requestId, Drawing drawing, CancellationToken ct)
    {
        var r = await LoadForUpdateAsync(requestId, ct);
        if (IsClosed(r.Status)) throw ApiException.Conflict($"Request {r.TicketNo} is already closed.");
        var from = r.Status;
        r.Status = RequestStatus.Completed; r.ClosedAtUtc = DateTime.UtcNow; r.UpdatedAtUtc = DateTime.UtcNow; r.ResultDrawingId = drawing.Id;
        r.AssignedToId ??= user.Id; r.ClosureNote = $"Drawing {drawing.DrawingNumber} uploaded.";
        db.RequestEvents.Add(new RequestEvent { RequestId = r.Id, ActorId = user.Id, Action = "Completed", FromStatus = from.ToString(), ToStatus = nameof(RequestStatus.Completed), Note = r.ClosureNote });
        audit.Add("RequestCompleted", "Request", r.Id, $"{r.TicketNo} closed - drawing {drawing.DrawingNumber} uploaded");
        var body = EmailTemplates.Build("Your drawing is ready", $"The drawing for request {r.TicketNo} has been uploaded and is now available in the portal.",
            [("Ticket", r.TicketNo), ("Drawing number", drawing.DrawingNumber), ("Request", r.Title)], "Open drawing", notifier.Link("/drawings/" + drawing.Id));
        notifier.Email(r.RequestedBy!.Email, r.RequestedBy.FullName, $"[Drawing Portal] {r.TicketNo} completed - drawing {drawing.DrawingNumber} is ready", body, "RequestCompleted");
        notifier.InApp(r.RequestedById, "Your drawing is ready", $"{r.TicketNo}: drawing {drawing.DrawingNumber} has been uploaded.", "/drawings/" + drawing.Id);
    }

    // ====================================================================== COMMENTS (technical discussion)
    private async Task<DrawingRequest> AuthorizedAsync(string id, CancellationToken ct) =>
        await Visible().Include(r => r.RequestedBy).Include(r => r.AssignedTo).FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw ApiException.NotFound("Request not found.");

    public async Task<IReadOnlyList<CommentViewDto>> ListCommentsAsync(string id, CancellationToken ct)
    {
        await AuthorizedAsync(id, ct);
        return await db.Comments.AsNoTracking().Where(c => c.RequestId == id).OrderBy(c => c.CreatedAtUtc)
            .Select(c => new CommentViewDto(c.Id, c.Body, c.AuthorId, c.Author!.FullName, c.Author.Role.ToString(), c.CreatedAtUtc)).ToListAsync(ct);
    }

    public async Task<CommentViewDto> AddCommentAsync(string id, string body, CancellationToken ct)
    {
        var r = await AuthorizedAsync(id, ct);
        // The query above is not tracked; re-attach only what we need.
        var text = Text.CleanMultiline(body, 4000);
        if (text.Length == 0) throw ApiException.BadRequest("Write a message first.", "body");
        var c = new RequestComment { RequestId = id, AuthorId = user.Id!, Body = text };
        db.Comments.Add(c);
        var preview = Text.Truncate(text, 600);
        if (user.IsAdmin && r.RequestedById != user.Id)
        {   // admin -> requestor: technical-discussion e-mail
            notifier.Email(r.RequestedBy!.Email, r.RequestedBy.FullName, $"[Drawing Portal] New message on {r.TicketNo}",
                EmailTemplates.Build("New technical message", $"{user.Name} (Application Engineering) replied on your request {r.TicketNo}.", [("Ticket", r.TicketNo), ("Request", r.Title)], "Reply in portal", Url(r), preview), "RequestComment");
            notifier.InApp(r.RequestedById, $"New message on {r.TicketNo}", Text.Truncate(text, 200), "/requests/" + id);
        }
        else if (!user.IsAdmin)
        {   // requestor -> assignee (or every admin when unassigned)
            var targets = r.AssignedTo is not null ? [r.AssignedTo] : await notifier.ActiveAdminsAsync(ct);
            foreach (var a in targets)
            {
                notifier.Email(a.Email, a.FullName, $"[Drawing Portal] {user.Name} replied on {r.TicketNo}",
                    EmailTemplates.Build("New technical message", $"{user.Name} replied on request {r.TicketNo}.", [("Ticket", r.TicketNo), ("Request", r.Title)], "Open request", Url(r), preview), "RequestComment");
                notifier.InApp(a.Id, $"New message on {r.TicketNo}", Text.Truncate(text, 200), "/requests/" + id);
            }
        }
        var tracked = await db.Requests.FirstAsync(x => x.Id == id, ct);
        tracked.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return new CommentViewDto(c.Id, c.Body, user.Id!, user.Name ?? "", user.IsAdmin ? "Admin" : "User", c.CreatedAtUtc);
    }
}