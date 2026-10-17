using DrawingPortal.Api.Common;

namespace DrawingPortal.Api.Domain;

public enum UserRole { User, Admin }
public enum DrawingStatus { Active, Archived }
public enum FileKind { Drawing, Document, RequestAttachment }
public enum RequestType { New, Modification }
public enum RequestStatus { Submitted, InReview, Assigned, InProgress, Completed, Rejected }
public enum RequestPriority { Standard, High, Critical }
public enum EmailStatus { Pending, Sent, Failed }
public enum JobStatus { Queued, Running, Completed, CompletedWithErrors, Failed }

public abstract class Entity
{
    public string Id { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class User : Entity
{
    public User() { Id = NanoId.New(Ids.User); }
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? Department { get; set; }
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAtUtc { get; set; }
    public int FailedOtpAttempts { get; set; }
    public DateTime? LockoutUntilUtc { get; set; }
}

public class OtpChallenge : Entity
{
    public OtpChallenge() { Id = NanoId.New(Ids.Otp); }
    public string UserId { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public DateTime ExpiresAtUtc { get; set; }
    public int Attempts { get; set; }
    public DateTime? ConsumedAtUtc { get; set; }
    public string? RequestIp { get; set; }
}

public class RefreshToken : Entity
{
    public RefreshToken() { Id = NanoId.New(Ids.Refresh); }
    public string UserId { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? CreatedIp { get; set; }
}

// ---------- Master data ----------
public abstract class NamedMaster : Entity
{
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
public class VehicleCategory : NamedMaster { public VehicleCategory() { Id = NanoId.New(Ids.Category); } }
public class VehicleType : NamedMaster { public VehicleType() { Id = NanoId.New(Ids.VehicleType); } }
public class Make : NamedMaster { public Make() { Id = NanoId.New(Ids.Make); } }
public class ConnectorType : NamedMaster { public ConnectorType() { Id = NanoId.New(Ids.Connector); } }

public class VoltagePreset : Entity
{
    public VoltagePreset() { Id = NanoId.New(Ids.Voltage); }
    public int ValueV { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AhRating : Entity
{
    public AhRating() { Id = NanoId.New(Ids.Ah); }
    public int Value { get; set; }
    /// <summary>Standard suffix such as "DIN"; empty string when none (never null so unique index behaves the same on every DB).</summary>
    public string Standard { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string Label => Standard.Length == 0 ? Value.ToString() : $"{Value}({Standard})";
}

public class VehicleModel : Entity
{
    public VehicleModel() { Id = NanoId.New(Ids.Model); }
    public string MakeId { get; set; } = "";
    public string VehicleTypeId { get; set; } = "";
    public string CategoryId { get; set; } = "";
    public string ModelName { get; set; } = "";
    public string Capacity { get; set; } = "";
    public bool IsActive { get; set; } = true;
    /// <summary>Simple sequential number (1, 2, 3 ...) shown to users instead of the long internal id.</summary>
    public int Serial { get; set; }
    public Make? Make { get; set; }
    public VehicleType? VehicleType { get; set; }
    public VehicleCategory? Category { get; set; }
}

/// <summary>
/// "OEM specified" battery for a vehicle model: the voltage (and optionally an Ah rating) that belongs to the model.
/// A row with a null AhRatingId only links the voltage. Used to restrict the Voltage / Ah drop-downs in drawing search.
/// </summary>
public class ModelBattery : Entity
{
    public ModelBattery() { Id = NanoId.New(Ids.ModelBattery); }
    public string ModelId { get; set; } = "";
    public int VoltageV { get; set; }
    public string? AhRatingId { get; set; }
}

// ---------- Drawings ----------
public class StoredFile : Entity
{
    public StoredFile() { Id = NanoId.New(Ids.File); }
    public FileKind Kind { get; set; }
    public string OriginalName { get; set; } = "";
    public string StoredPath { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string Extension { get; set; } = "";
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = "";
    /// <summary>Relative, host-agnostic URL persisted for reuse (e.g. in bulk Excel files): /api/files/{id}</summary>
    public string Url { get; set; } = "";
    public string? UploadedById { get; set; }
    /// <summary>Set on the returned object when an upload matched a file already stored (not persisted).</summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped] public bool WasExisting { get; set; }
}

public class Drawing : Entity
{
    public Drawing() { Id = NanoId.New(Ids.Drawing); }
    public string DrawingNumber { get; set; } = "";
    public string ModelId { get; set; } = "";
    public int VoltageV { get; set; }
    public int AhValue { get; set; }
    public string AhStandard { get; set; } = "";
    public int LengthMm { get; set; }
    public int WidthMm { get; set; }
    public int HeightMm { get; set; }
    public string ConnectorTypeId { get; set; } = "";
    public string? Comments { get; set; }
    public string? CompetitorDrawingNumber { get; set; }
    public DrawingStatus Status { get; set; } = DrawingStatus.Active;
    public int CurrentRevisionNo { get; set; } = 1;
    /// <summary>Simple sequential number (1, 2, 3 ...) shown to users instead of the long internal id.</summary>
    public int Serial { get; set; }
    public string? CurrentFileId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedById { get; set; }
    public string? CreatedById { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public VehicleModel? Model { get; set; }
    public ConnectorType? Connector { get; set; }
    public StoredFile? CurrentFile { get; set; }
    public List<DrawingRevision> Revisions { get; set; } = new();
    public string AhLabel => AhStandard.Length == 0 ? AhValue.ToString() : $"{AhValue}({AhStandard})";
}

public class DrawingRevision : Entity
{
    public DrawingRevision() { Id = NanoId.New(Ids.Revision); }
    public string DrawingId { get; set; } = "";
    public int RevisionNo { get; set; }
    public string DrawingNumber { get; set; } = "";
    public string? FileId { get; set; }
    public string? ChangeNotes { get; set; }
    public string? SnapshotJson { get; set; }
    public string? CreatedById { get; set; }
    public string? RequestId { get; set; }
    public Drawing? Drawing { get; set; }
    public StoredFile? File { get; set; }
}

// ---------- Requests ----------
public class DrawingRequest : Entity
{
    public DrawingRequest() { Id = NanoId.New(Ids.Request); }
    public string TicketNo { get; set; } = "";
    public RequestType Type { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Submitted;
    public RequestPriority Priority { get; set; } = RequestPriority.Standard;
    public string RequestedById { get; set; } = "";
    public string? AssignedToId { get; set; }
    public string Title { get; set; } = "";
    /// <summary>Existing drawing being modified, or the drawing a new request was cloned from.</summary>
    public string? RelatedDrawingId { get; set; }
    // Requested specification (all optional for modification = "unchanged")
    public string? CategoryName { get; set; }
    public string? VehicleTypeName { get; set; }
    public string? MakeName { get; set; }
    public string? ModelName { get; set; }
    public string? Capacity { get; set; }
    public int? VoltageV { get; set; }
    public int? AhValue { get; set; }
    public string? AhStandard { get; set; }
    public int? LengthMm { get; set; }
    public int? WidthMm { get; set; }
    public int? HeightMm { get; set; }
    public string? ConnectorName { get; set; }
    public string? ChangeType { get; set; }
    public DateTime? TargetDateUtc { get; set; }
    public string? Description { get; set; }
    public string? Reason { get; set; }
    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAtUtc { get; set; }
    public string? ClosureNote { get; set; }
    public string? ResultDrawingId { get; set; }
    public User? RequestedBy { get; set; }
    public User? AssignedTo { get; set; }
    public Drawing? RelatedDrawing { get; set; }
    public Drawing? ResultDrawing { get; set; }
    public List<RequestAttachment> Attachments { get; set; } = new();
    public List<RequestEvent> Events { get; set; } = new();
}

public class RequestAttachment : Entity
{
    public RequestAttachment() { Id = NanoId.New(Ids.Attachment); }
    public string RequestId { get; set; } = "";
    public string FileId { get; set; } = "";
    public StoredFile? File { get; set; }
}

public class RequestEvent : Entity
{
    public RequestEvent() { Id = NanoId.New(Ids.RequestEvent); }
    public string RequestId { get; set; } = "";
    public string? ActorId { get; set; }
    public string Action { get; set; } = "";
    public string? FromStatus { get; set; }
    public string? ToStatus { get; set; }
    public string? Note { get; set; }
    public User? Actor { get; set; }
}

public class RequestComment : Entity
{
    public RequestComment() { Id = NanoId.New(Ids.Comment); }
    public string RequestId { get; set; } = "";
    public string AuthorId { get; set; } = "";
    public string Body { get; set; } = "";
    public User? Author { get; set; }
}

// ---------- Platform ----------
public class Notification : Entity
{
    public Notification() { Id = NanoId.New(Ids.Notification); }
    public string UserId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string? LinkPath { get; set; }
    public bool IsRead { get; set; }
}

public class EmailOutbox : Entity
{
    public EmailOutbox() { Id = NanoId.New(Ids.Email); }
    public string ToAddress { get; set; } = "";
    public string? ToName { get; set; }
    public string Subject { get; set; } = "";
    public string HtmlBody { get; set; } = "";
    public string TextBody { get; set; } = "";
    public string Category { get; set; } = "";
    public EmailStatus Status { get; set; } = EmailStatus.Pending;
    public int Attempts { get; set; }
    public DateTime NextAttemptAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? SentAtUtc { get; set; }
    public string? LastError { get; set; }
}

public class AuditLog : Entity
{
    public AuditLog() { Id = NanoId.New(Ids.Audit); }
    public string? ActorId { get; set; }
    public string ActorEmail { get; set; } = "system";
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    public string Summary { get; set; } = "";
    public string? DetailsJson { get; set; }
    public string? IpAddress { get; set; }
}

public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? UpdatedBy { get; set; }
}

public class TicketCounter
{
    public string Prefix { get; set; } = "";
    public int Year { get; set; }
    public int LastValue { get; set; }
    public int Version { get; set; }
}

public class PortalDocument : Entity
{
    public PortalDocument() { Id = NanoId.New(Ids.Document); }
    public string Title { get; set; } = "";
    public string Category { get; set; } = "General";
    public string? Description { get; set; }
    public string FileId { get; set; } = "";
    public string? UploadedById { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public StoredFile? File { get; set; }
}

public class BulkImportJob : Entity
{
    public BulkImportJob() { Id = NanoId.New(Ids.Job); }
    public JobStatus Status { get; set; } = JobStatus.Queued;
    public string OriginalFileName { get; set; } = "";
    public string TempPath { get; set; } = "";
    public string RequestedById { get; set; } = "";
    public bool SkipDuplicates { get; set; } = true;
    public bool AutoCreateMaster { get; set; }
    public int TotalRows { get; set; }
    public int ProcessedRows { get; set; }
    public int CreatedCount { get; set; }
    public int SkippedCount { get; set; }
    public int ErrorCount { get; set; }
    public string? FailureMessage { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }
}

public class BulkImportRowError
{
    public long Id { get; set; }
    public string JobId { get; set; } = "";
    public int RowNumber { get; set; }
    public string? DrawingNumber { get; set; }
    public string Message { get; set; } = "";
}
