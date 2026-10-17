using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Options;
using DrawingPortal.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Workers;

/// <summary>Polls the e-mail outbox. Failed sends back off exponentially, so a down SMTP server never blocks or loses mail.</summary>
public sealed class EmailOutboxWorker(IServiceScopeFactory scopes, EmailSignal signal, IOptions<WorkerOptions> opt, ILogger<EmailOutboxWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!opt.Value.Enabled) return;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var sent = await scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>().ProcessOnceAsync(ct: ct);
                await signal.WaitAsync(sent > 0 ? TimeSpan.FromMilliseconds(300) : TimeSpan.FromSeconds(3), ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { log.LogError(ex, "Email outbox loop error"); await Task.Delay(TimeSpan.FromSeconds(15), ct); }
        }
    }
}

/// <summary>Runs bulk Excel imports one at a time on a background thread so the interactive API is unaffected.</summary>
public sealed class BulkImportWorker(IServiceScopeFactory scopes, BulkImportQueue queue, IOptions<WorkerOptions> opt, ILogger<BulkImportWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!opt.Value.Enabled) return;
        try
        {   // recover from restarts: interrupted jobs are failed, queued ones resume
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            foreach (var j in await db.BulkJobs.Where(j => j.Status == JobStatus.Running).ToListAsync(ct))
            { j.Status = JobStatus.Failed; j.FailureMessage = "Interrupted by a server restart. Upload the file again with 'Skip duplicates' ticked."; j.FinishedAtUtc = DateTime.UtcNow; }
            await db.SaveChangesAsync(ct);
            foreach (var id in await db.BulkJobs.Where(j => j.Status == JobStatus.Queued).OrderBy(j => j.CreatedAtUtc).Select(j => j.Id).ToListAsync(ct)) queue.Enqueue(id);
        }
        catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning(ex, "Bulk recovery skipped"); }

        await foreach (var id in queue.ReadAllAsync(ct))
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IBulkImportService>().ProcessAsync(id, ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { log.LogError(ex, "Bulk import {Job} crashed", id); }
        }
    }
}

/// <summary>Housekeeping: purges expired OTP challenges / refresh tokens and old sent e-mails.</summary>
public sealed class MaintenanceWorker(IServiceScopeFactory scopes, IOptions<WorkerOptions> opt, ILogger<MaintenanceWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!opt.Value.Enabled) return;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTime.UtcNow;
                await db.OtpChallenges.Where(c => c.ExpiresAtUtc < now.AddDays(-1)).ExecuteDeleteAsync(ct);
                await db.RefreshTokens.Where(t => t.ExpiresAtUtc < now.AddDays(-7) || (t.RevokedAtUtc != null && t.RevokedAtUtc < now.AddDays(-7))).ExecuteDeleteAsync(ct);
                await db.EmailOutbox.Where(e => e.Status == EmailStatus.Sent && e.SentAtUtc < now.AddDays(-30)).ExecuteDeleteAsync(ct);
                await db.Notifications.Where(n => n.IsRead && n.CreatedAtUtc < now.AddDays(-90)).ExecuteDeleteAsync(ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { log.LogWarning(ex, "Maintenance pass failed"); }
            try { await Task.Delay(TimeSpan.FromHours(6), ct); } catch (OperationCanceledException) { break; }
        }
    }
}
