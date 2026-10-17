using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;

namespace DrawingPortal.Api.Services;

public interface IEmailTransport { Task SendAsync(EmailOutbox mail, CancellationToken ct); }

/// <summary>Writes .eml files instead of sending - used while SMTP settings are still dummy values.</summary>
public sealed class FileEmailTransport(IOptions<EmailOptions> o, IWebHostEnvironment env) : IEmailTransport
{
    public async Task SendAsync(EmailOutbox mail, CancellationToken ct)
    {
        var dir = Path.IsPathRooted(o.Value.FileDropPath) ? o.Value.FileDropPath : Path.Combine(env.ContentRootPath, o.Value.FileDropPath);
        Directory.CreateDirectory(dir);
        var msg = Build(mail, o.Value);
        await using var fs = File.Create(Path.Combine(dir, $"{mail.CreatedAtUtc:yyyyMMdd-HHmmss}-{mail.Id}.eml"));
        await msg.WriteToAsync(fs, ct);
    }
    internal static MimeMessage Build(EmailOutbox mail, EmailOptions o)
    {
        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(o.FromName, o.FromAddress));
        msg.To.Add(new MailboxAddress(mail.ToName ?? mail.ToAddress, mail.ToAddress));
        msg.Subject = mail.Subject;
        var builder = new BodyBuilder { HtmlBody = mail.HtmlBody, TextBody = mail.TextBody };
        foreach (var cid in EmailAssets.Cids)   // inline (CID) logos: shown by Outlook/Gmail without "download pictures"
        {
            if (!mail.HtmlBody.Contains("cid:" + cid, StringComparison.Ordinal)) continue;
            var bytes = EmailAssets.Get(cid);
            if (bytes is null) continue;
            var img = builder.LinkedResources.Add(cid + ".png", bytes, ContentType.Parse("image/png"));
            img.ContentId = cid;
        }
        msg.Body = builder.ToMessageBody();
        return msg;
    }
}

public sealed class SmtpEmailTransport(IOptions<EmailOptions> o) : IEmailTransport
{
    public async Task SendAsync(EmailOutbox mail, CancellationToken ct)
    {
        var s = o.Value.Smtp;
        using var client = new SmtpClient { Timeout = 20000, CheckCertificateRevocation = s.CheckCertificateRevocation };
        await client.ConnectAsync(s.Host, s.Port, s.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto, ct);
        if (!string.IsNullOrEmpty(s.Username)) await client.AuthenticateAsync(s.Username, s.Password, ct);
        await client.SendAsync(FileEmailTransport.Build(mail, o.Value), ct);
        await client.DisconnectAsync(true, ct);
    }
}

public sealed class EmailOutboxProcessor(AppDbContext db, IEmailTransport transport, IOptions<EmailOptions> opts, IOptions<AuthOptions> auth, ILogger<EmailOutboxProcessor> log)
{
    /// <summary>Sends due emails with exponential back-off (1, 2, 4 ... min). Returns number sent.</summary>
    public async Task<int> ProcessOnceAsync(int batch = 20, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var due = await db.EmailOutbox.Where(e => e.Status == EmailStatus.Pending && e.NextAttemptAtUtc <= now)
            .OrderBy(e => e.NextAttemptAtUtc).Take(batch).ToListAsync(ct);
        var sent = 0;
        foreach (var mail in due)
        {
            // A sign-in code is useless once it has expired (and a stale code only confuses the user): drop it instead of sending late.
            if (mail.Category == "Otp" && now > mail.CreatedAtUtc.AddMinutes(auth.Value.OtpMinutes))
            { mail.Status = EmailStatus.Failed; mail.LastError = "Sign-in code expired before it could be delivered."; continue; }
            try
            {
                await transport.SendAsync(mail, ct);
                mail.Status = EmailStatus.Sent; mail.SentAtUtc = DateTime.UtcNow; mail.LastError = null; sent++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                mail.Attempts++;
                mail.LastError = Common.Text.Truncate(ex.Message, 900);
                if (mail.Attempts >= opts.Value.MaxAttempts) mail.Status = EmailStatus.Failed;
                else mail.NextAttemptAtUtc = mail.Category == "Otp"
                    ? DateTime.UtcNow.AddSeconds(Math.Min(30, 3 * Math.Pow(2, mail.Attempts - 1)))   // codes: 3s, 6s, 12s, 24s, 30s ...
                    : DateTime.UtcNow.AddMinutes(Math.Pow(2, Math.Min(mail.Attempts, 8)));            // everything else: 2, 4, 8 ... minutes
                log.LogWarning("Email {Id} ({Category}) attempt {N} failed: {Error}", mail.Id, mail.Category, mail.Attempts, ex.Message);
            }
        }
        if (due.Count > 0) await db.SaveChangesAsync(ct);
        return sent;
    }
}
