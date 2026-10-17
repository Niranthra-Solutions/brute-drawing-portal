using System.Security.Cryptography;
using System.Text;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Options;
using DrawingPortal.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Security;

public interface IOtpService
{
    Task RequestAsync(string email, string? ip, CancellationToken ct);
    Task<User?> VerifyAsync(string email, string code, string? ip, CancellationToken ct);
}

/// <summary>
/// Email one-time-password sign-in.
///  - 6-digit code from a CSPRNG; only an HMAC (keyed with the server secret) is stored, never the code.
///  - 5 minute expiry, single use, max 5 guesses per code, account lock-out after repeated failures.
///  - The "request" endpoint never reveals whether an e-mail address is registered.
///  - Exactly one dummy test-admin may use a fixed code (config-driven, logged loudly at start-up).
/// </summary>
public sealed class OtpService(AppDbContext db, INotifier notifier, IAuditService audit, IOptions<AuthOptions> authOpt, IOptions<JwtOptions> jwt, EmailSignal signal, ILogger<OtpService> log) : IOtpService
{
    private AuthOptions A => authOpt.Value;
    public static string NormalizeEmail(string? e) => (e ?? "").Trim().ToLowerInvariant();

    private bool IsTestAdmin(string email) => A.TestAdmin.Enabled && string.Equals(email, NormalizeEmail(A.TestAdmin.Email), StringComparison.Ordinal);

    private string Hmac(string challengeId, string email, string code)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes("otp-pepper:" + jwt.Value.Secret));
        return Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{challengeId}|{email}|{code}"))).ToLowerInvariant();
    }

    public async Task RequestAsync(string email, string? ip, CancellationToken ct)
    {
        email = NormalizeEmail(email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct);
        if (user is null) { log.LogInformation("OTP requested for unknown or inactive address."); return; }
        if (IsTestAdmin(email)) return;                                  // fixed code, nothing to send
        var now = DateTime.UtcNow;
        if (user.LockoutUntilUtc > now) return;

        var recent = await db.OtpChallenges.Where(c => c.UserId == user.Id && c.CreatedAtUtc > now.AddHours(-1))
            .OrderByDescending(c => c.CreatedAtUtc).Select(c => c.CreatedAtUtc).ToListAsync(ct);
        if (recent.Count >= A.MaxOtpPerHour) return;
        if (recent.Count > 0 && recent[0] > now.AddSeconds(-A.ResendCooldownSeconds)) return;

        // Keep the two previous still-valid codes usable (a delayed e-mail must not be invalidated by a newer request); retire anything older.
        var live = await db.OtpChallenges.Where(c => c.UserId == user.Id && c.ConsumedAtUtc == null).OrderByDescending(c => c.CreatedAtUtc).ToListAsync(ct);
        foreach (var old in live.Skip(2)) old.ConsumedAtUtc = now;

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var ch = new OtpChallenge { UserId = user.Id, ExpiresAtUtc = now.AddMinutes(A.OtpMinutes), RequestIp = ip };
        ch.CodeHash = Hmac(ch.Id, email, code);
        db.OtpChallenges.Add(ch);
        notifier.Email(user.Email, user.FullName, "Your Drawing Portal sign-in code", EmailTemplates.Otp(code, A.OtpMinutes), "Otp");
        await db.SaveChangesAsync(ct);
        signal.Notify();                                   // send the code right away
    }

    public async Task<User?> VerifyAsync(string email, string code, string? ip, CancellationToken ct)
    {
        email = NormalizeEmail(email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct);
        if (user is null) return null;
        var now = DateTime.UtcNow;
        if (user.LockoutUntilUtc > now) { log.LogWarning("OTP verify for {Email} rejected: account locked until {Until:u} after repeated wrong codes", email, user.LockoutUntilUtc); return null; }

        bool ok;
        if (IsTestAdmin(email))
        {
            ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(code), Encoding.UTF8.GetBytes(A.TestAdmin.FixedOtp));
        }
        else
        {
            var actives = await db.OtpChallenges.Where(c => c.UserId == user.Id && c.ConsumedAtUtc == null && c.ExpiresAtUtc > now)
                .OrderByDescending(c => c.CreatedAtUtc).Take(3).ToListAsync(ct);
            if (actives.Count == 0) { log.LogInformation("OTP verify for {Email} rejected: no active code (expired, already used, or never delivered)", email); return null; }
            ok = false;
            foreach (var ch in actives)
            {
                ch.Attempts++;
                if (ch.Attempts > A.OtpMaxAttempts) { ch.ConsumedAtUtc = now; continue; }
                if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hmac(ch.Id, email, code)), Encoding.ASCII.GetBytes(ch.CodeHash))) ok = true;
            }
            if (ok) foreach (var ch in actives) ch.ConsumedAtUtc = now;
            else log.LogInformation("OTP verify for {Email} rejected: code does not match any of the {N} active code(s)", email, actives.Count);
        }

        if (!ok)
        {
            user.FailedOtpAttempts++;
            if (user.FailedOtpAttempts >= A.MaxFailuresBeforeLockout)
            {
                user.LockoutUntilUtc = now.AddMinutes(A.LockoutMinutes); user.FailedOtpAttempts = 0;
                audit.Add("AccountLocked", "User", user.Id, $"Account locked after repeated invalid codes ({user.Email})", actorId: user.Id, actorEmail: user.Email);
            }
            await db.SaveChangesAsync(ct);
            return null;
        }
        user.FailedOtpAttempts = 0; user.LockoutUntilUtc = null; user.LastLoginAtUtc = now;
        audit.Add("Login", "User", user.Id, $"{user.Email} signed in", actorId: user.Id, actorEmail: user.Email);
        await db.SaveChangesAsync(ct);
        return user;
    }
}
