using System.ComponentModel.DataAnnotations;
using DrawingPortal.Api.Domain;

namespace DrawingPortal.Api.Dtos;

// ---------- Auth / users ----------
public sealed class RequestOtpDto { [Required, EmailAddress, StringLength(254)] public string Email { get; set; } = ""; }
public sealed class VerifyOtpDto
{
    [Required, EmailAddress, StringLength(254)] public string Email { get; set; } = "";
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Enter the 6-digit code.")] public string Code { get; set; } = "";
}
public sealed record UserDto(string Id, string Email, string FullName, string? Department, string Role, bool IsActive, DateTime? LastLoginAtUtc, DateTime CreatedAtUtc);
public sealed class SaveUserDto
{
    [Required, EmailAddress, StringLength(254)] public string Email { get; set; } = "";
    [Required, StringLength(120, MinimumLength = 2)] public string FullName { get; set; } = "";
    [StringLength(120)] public string? Department { get; set; }
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsActive { get; set; } = true;
}

// ---------- Lookups ----------
public sealed record NamedItemDto(string Id, string Name, int SortOrder, bool IsActive);
public sealed record ModelDto(string Id, string MakeId, string VehicleTypeId, string CategoryId, string Name, string Capacity, bool IsActive);
public sealed record AhDto(string Id, int Value, string Standard, string Label, bool IsActive);
public sealed record VoltageDto(string Id, int ValueV, bool IsActive);
public sealed record ToleranceDto(int LengthMm, int WidthMm, int HeightMm);
public sealed record BootstrapDto(
    IReadOnlyList<NamedItemDto> Categories, IReadOnlyList<NamedItemDto> VehicleTypes, IReadOnlyList<NamedItemDto> Makes,
    IReadOnlyList<NamedItemDto> Connectors, IReadOnlyList<ModelDto> Models, IReadOnlyList<VoltageDto> Voltages,
    IReadOnlyList<AhDto> AhRatings, string DrawingNumberMask, string DrawingNumberExample, ToleranceDto Tolerance);

public sealed class SaveNamedDto { [Required, StringLength(120, MinimumLength = 1)] public string Name { get; set; } = ""; public int SortOrder { get; set; } public bool IsActive { get; set; } = true; }
public sealed class SaveModelDto
{
    [Required] public string MakeId { get; set; } = ""; [Required] public string VehicleTypeId { get; set; } = ""; [Required] public string CategoryId { get; set; } = "";
    [Required, StringLength(120)] public string Name { get; set; } = ""; [Required, StringLength(40)] public string Capacity { get; set; } = ""; public bool IsActive { get; set; } = true;
}
public sealed class SaveVoltageDto { [Range(1, 2000)] public int ValueV { get; set; } public bool IsActive { get; set; } = true; }
public sealed class SaveAhDto { [Range(1, 100000)] public int Value { get; set; } [StringLength(20)] public string? Standard { get; set; } public bool IsActive { get; set; } = true; }

public sealed class SaveSettingsDto
{
    [Required, StringLength(40)] public string NumberMask { get; set; } = "";
    public int ToleranceLengthMm { get; set; } public int ToleranceWidthMm { get; set; } public int ToleranceHeightMm { get; set; }
}
public sealed record SettingsDto(string NumberMask, string Example, int ToleranceLengthMm, int ToleranceWidthMm, int ToleranceHeightMm);

// ---------- Drawings ----------
public sealed record DrawingRow(
    string Id, string DrawingNumber, string Make, string MakeId, string VehicleType, string Category, string Model, string ModelId, string Capacity,
    int VoltageV, int AhValue, string AhStandard, string Connector, string ConnectorId, int LengthMm, int WidthMm, int HeightMm,
    string? Comments, string? CompetitorDrawingNumber, DrawingStatus Status, int RevisionNo, string? FileId, string? FileName, DateTime UpdatedAtUtc);

public sealed record DrawingDto(
    string Id, string DrawingNumber, string Make, string MakeId, string VehicleType, string Category, string Model, string ModelId, string Capacity,
    int VoltageV, string Ah, int AhValue, string AhStandard, string Connector, string ConnectorId, int LengthMm, int WidthMm, int HeightMm,
    string? Comments, string? CompetitorDrawingNumber, string Status, string RevisionLabel, string? FileId, string? FileName, bool CanPreview, DateTime UpdatedAtUtc);

public sealed record SuggestionDto(DrawingDto Drawing, int DeltaLength, int DeltaWidth, int DeltaHeight, double FitPercent, bool SameModel, bool SameMake, bool SameAh);
public sealed record SearchResultDto(string Mode, IReadOnlyList<DrawingDto> Exact, IReadOnlyList<SuggestionDto> Similar, ToleranceDto Tolerance, string? Note, int TotalCandidates);
public sealed record RevisionDto(string Id, int RevisionNo, string Label, string DrawingNumber, string? FileId, string? FileName, string? ChangeNotes, DateTime CreatedAtUtc, string? CreatedByName, string? RequestTicketNo, bool IsCurrent);
public sealed record FileInfoDto(string Id, string Name, string ContentType, long SizeBytes, string Sha256, string Url, DateTime CreatedAtUtc, bool CanPreview);
public sealed record DrawingDetailDto(DrawingDto Drawing, IReadOnlyList<RevisionDto> Revisions, FileInfoDto? File, DateTime CreatedAtUtc, string? CreatedByName, string? MatchedNote);

public class DrawingInput
{
    [Required, StringLength(40)] public string DrawingNumber { get; set; } = "";
    [Required] public string ModelId { get; set; } = "";
    public int VoltageV { get; set; }
    public int AhValue { get; set; }
    [StringLength(20)] public string? AhStandard { get; set; }
    public int LengthMm { get; set; }
    public int WidthMm { get; set; }
    public int HeightMm { get; set; }
    public string ConnectorTypeId { get; set; } = "";
    /// <summary>Free-text connector. Used when no ConnectorTypeId is given; matched by name (case-insensitive) or added to master data.</summary>
    [StringLength(100)] public string? ConnectorName { get; set; }
    [StringLength(2000)] public string? Comments { get; set; }
    [StringLength(60)] public string? CompetitorDrawingNumber { get; set; }
}
public sealed class CreateDrawingDto : DrawingInput
{
    [Required] public string FileId { get; set; } = "";
    [StringLength(2000)] public string? ChangeNotes { get; set; }
    public string? RequestId { get; set; }
}
public sealed class UpdateDrawingDto : DrawingInput
{
    public DrawingStatus Status { get; set; } = DrawingStatus.Active;
    /// <summary>Optional corrected drawing file. Replaces the current file in place (no new revision) - for fixing a wrong upload.</summary>
    public string? FileId { get; set; }
}
public sealed class AddRevisionDto
{
    [Required] public string FileId { get; set; } = "";
    [Required, StringLength(2000, MinimumLength = 3)] public string ChangeNotes { get; set; } = "";
    [StringLength(40)] public string? NewDrawingNumber { get; set; }
    public string? RequestId { get; set; }
    public string? ModelId { get; set; }
    public int? VoltageV { get; set; }
    public int? AhValue { get; set; }
    public string? AhStandard { get; set; }
    public int? LengthMm { get; set; }
    public int? WidthMm { get; set; }
    public int? HeightMm { get; set; }
    public string? ConnectorTypeId { get; set; }
    [StringLength(100)] public string? ConnectorName { get; set; }
}
public sealed class DrawingListQuery
{
    public string? Q { get; set; } public string? CategoryId { get; set; } public string? MakeId { get; set; }
    public int? VoltageV { get; set; } public DrawingStatus? Status { get; set; }
    public string Sort { get; set; } = "updated"; public string Dir { get; set; } = "desc";
    public int Page { get; set; } = 1; public int PageSize { get; set; } = 25;
}
public sealed class SearchQueryDto
{
    public string? ModelId { get; set; }
    public int VoltageV { get; set; }
    public int AhValue { get; set; }
    public string? AhStandard { get; set; }
    public int LengthMm { get; set; }
    public int WidthMm { get; set; }
    public int HeightMm { get; set; }
    public bool IncludeSimilar { get; set; }
}

// ---------- Files / documents ----------
public sealed record DrawingFileListItemDto(string Id, string Name, string Extension, long SizeBytes, string ContentType, string Url, string AbsoluteUrl, DateTime UploadedAtUtc, string? UploadedByName, int UsedByCount, IReadOnlyList<string> DrawingNumbers);
public sealed record UploadedFileDto(string Id, string Name, long SizeBytes, string ContentType, string Url, string AbsoluteUrl, string Sha256);
public sealed record DocumentDto(string Id, string Title, string Category, string? Description, string FileId, string FileName, string Extension, long SizeBytes, DateTime CreatedAtUtc, bool CanPreview);
public sealed class SaveDocumentDto
{
    [Required, StringLength(200, MinimumLength = 2)] public string Title { get; set; } = "";
    [Required, StringLength(80)] public string Category { get; set; } = "General";
    [StringLength(1000)] public string? Description { get; set; }
    public string? FileId { get; set; }
}

// ---------- Requests ----------
public sealed class CreateRequestDto
{
    [Required] public RequestType Type { get; set; }
    public RequestPriority Priority { get; set; } = RequestPriority.Standard;
    public string? RelatedDrawingId { get; set; }
    [StringLength(60)] public string? CategoryName { get; set; }
    [StringLength(100)] public string? VehicleTypeName { get; set; }
    [StringLength(100)] public string? MakeName { get; set; }
    [StringLength(120)] public string? ModelName { get; set; }
    [StringLength(40)] public string? Capacity { get; set; }
    public int? VoltageV { get; set; }
    public int? AhValue { get; set; }
    [StringLength(20)] public string? AhStandard { get; set; }
    public int? LengthMm { get; set; }
    public int? WidthMm { get; set; }
    public int? HeightMm { get; set; }
    [StringLength(100)] public string? ConnectorName { get; set; }
    [StringLength(40)] public string? ChangeType { get; set; }
    public DateTime? TargetDate { get; set; }
    [StringLength(4000)] public string? Description { get; set; }
    [StringLength(2000)] public string? Reason { get; set; }
    public List<string> AttachmentFileIds { get; set; } = new();
}
public sealed class RequestListQuery
{
    public RequestType? Type { get; set; } public RequestStatus? Status { get; set; } public RequestPriority? Priority { get; set; }
    public string? Q { get; set; } public string Sort { get; set; } = "submitted"; public string Dir { get; set; } = "desc";
    public int Page { get; set; } = 1; public int PageSize { get; set; } = 25;
}
public sealed record RequestListItemDto(string Id, string TicketNo, string Type, string Status, string Priority, string Title, string RequestedByName, string RequestedByEmail,
    string? AssignedToName, string? RelatedDrawingNumber, DateTime SubmittedAtUtc, DateTime UpdatedAtUtc);
public sealed record AttachmentDto(string FileId, string Name, long SizeBytes, string Url, bool CanPreview);
public sealed record RequestEventDto(string Id, string Action, string? FromStatus, string? ToStatus, string? Note, string? ActorName, DateTime CreatedAtUtc);
public sealed record RequestDetailDto(
    string Id, string TicketNo, string Type, string Status, string Priority, string Title,
    string RequestedById, string RequestedByName, string RequestedByEmail, string? AssignedToId, string? AssignedToName,
    DrawingDto? RelatedDrawing, string? CategoryName, string? VehicleTypeName, string? MakeName, string? ModelName, string? Capacity,
    int? VoltageV, string? Ah, int? LengthMm, int? WidthMm, int? HeightMm, string? ConnectorName,
    string? ChangeType, DateTime? TargetDate, string? Description, string? Reason, DateTime SubmittedAtUtc, DateTime UpdatedAtUtc, DateTime? ClosedAtUtc,
    string? ClosureNote, string? ResultDrawingId, string? ResultDrawingNumber, DrawingDto? ResultDrawing,
    IReadOnlyList<AttachmentDto> Attachments, IReadOnlyList<RequestEventDto> Events, bool CanManage, bool IsClosed);
public sealed class ChangeStatusDto
{
    [Required] public RequestStatus Status { get; set; }
    [StringLength(2000)] public string? Note { get; set; }
    [StringLength(40)] public string? ResultDrawingNumber { get; set; }
}
public sealed class AssignDto { [Required] public string AssigneeId { get; set; } = ""; }
public sealed class CommentDto { [Required, StringLength(4000, MinimumLength = 1)] public string Body { get; set; } = ""; }
public sealed record CommentViewDto(string Id, string Body, string AuthorId, string AuthorName, string AuthorRole, DateTime CreatedAtUtc);
public sealed record RequestStatsDto(int Total, int Open, int InProgress, int Completed, int Rejected, int CriticalOpen, int Completed30Days, double AvgTurnaroundDays);

// ---------- Platform ----------
public sealed record NotificationDto(string Id, string Title, string Message, string? LinkPath, bool IsRead, DateTime CreatedAtUtc);
public sealed record AuditDto(string Id, DateTime CreatedAtUtc, string ActorEmail, string Action, string EntityType, string? EntityId, string Summary, string? DetailsJson, string? IpAddress);
public sealed class AuditQuery { public string? Q { get; set; } public string? EntityType { get; set; } public string? Action { get; set; } public DateTime? From { get; set; } public DateTime? To { get; set; } public int Page { get; set; } = 1; public int PageSize { get; set; } = 50; }
public sealed record BulkJobDto(string Id, string Status, string FileName, int TotalRows, int ProcessedRows, int CreatedCount, int SkippedCount, int ErrorCount, string? FailureMessage, bool SkipDuplicates, bool AutoCreateMaster, DateTime CreatedAtUtc, DateTime? StartedAtUtc, DateTime? FinishedAtUtc);
public sealed record BulkErrorDto(int RowNumber, string? DrawingNumber, string Message);
public sealed record DashboardDto(int TotalDrawings, int ActiveDrawings, int ArchivedDrawings, int AddedThisWeek, RequestStatsDto Requests, IReadOnlyList<RequestListItemDto> Recent, IReadOnlyList<WeeklyPointDto> Turnaround, IReadOnlyList<AuditDto> Activity);
public sealed record WeeklyPointDto(string Label, double AvgDays, int Closed);