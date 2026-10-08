using System.Text.Json;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;

namespace DrawingPortal.Api.Services;

public interface IAuditService
{
    /// <summary>Stages an immutable audit row on the current DbContext; it is committed with the caller's SaveChanges.</summary>
    void Add(string action, string entityType, string? entityId, string summary, object? details = null, string? actorId = null, string? actorEmail = null);
}

public sealed class AuditService(AppDbContext db, ICurrentUser user) : IAuditService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public void Add(string action, string entityType, string? entityId, string summary, object? details = null, string? actorId = null, string? actorEmail = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            ActorId = actorId ?? user.Id,
            ActorEmail = Text.Truncate(actorEmail ?? user.Email ?? "system", 254),
            Action = action, EntityType = entityType, EntityId = entityId,
            Summary = Text.Truncate(summary, 500),
            DetailsJson = details is null ? null : JsonSerializer.Serialize(details, Json),
            IpAddress = user.Ip,
        });
    }
}
