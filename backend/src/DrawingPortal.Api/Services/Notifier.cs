using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Services;

public interface INotifier
{
    void Email(string to, string? toName, string subject, (string Html, string Text) body, string category);
    void InApp(string userId, string title, string message, string? linkPath);
    Task<List<User>> ActiveAdminsAsync(CancellationToken ct);
    string Link(string path);
}

/// <summary>Transactional outbox: emails and in-app notifications are staged on the caller's DbContext and committed atomically with the business change.</summary>
public sealed class Notifier(AppDbContext db, IOptions<PortalOptions> portal, IHttpContextAccessor http) : INotifier
{
    public void Email(string to, string? toName, string subject, (string Html, string Text) body, string category) =>
        db.EmailOutbox.Add(new EmailOutbox { ToAddress = to, ToName = toName, Subject = Text.Truncate(subject, 300), HtmlBody = body.Html, TextBody = body.Text, Category = category });

    public void InApp(string userId, string title, string message, string? linkPath) =>
        db.Notifications.Add(new Notification { UserId = userId, Title = Text.Truncate(title, 200), Message = Text.Truncate(message, 1000), LinkPath = linkPath });

    public Task<List<User>> ActiveAdminsAsync(CancellationToken ct) =>
        db.Users.AsNoTracking().Where(u => u.IsActive && u.Role == UserRole.Admin).ToListAsync(ct);

    public string Link(string path)
    {
        var baseUrl = portal.Value.PublicBaseUrl;
        if (string.IsNullOrWhiteSpace(baseUrl) && http.HttpContext is { } c) baseUrl = $"{c.Request.Scheme}://{c.Request.Host}";
        return baseUrl.TrimEnd('/') + path;
    }
}
