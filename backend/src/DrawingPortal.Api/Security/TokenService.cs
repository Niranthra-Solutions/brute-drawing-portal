using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DrawingPortal.Api.Security;

public sealed record IssuedTokens(string AccessToken, DateTime AccessExpiresUtc, string RefreshToken, DateTime RefreshExpiresUtc);

public interface ITokenService
{
    IssuedTokens Issue(User user, string? ip);
    Task<(User? User, IssuedTokens? Tokens)> RefreshAsync(string refreshToken, string? ip, CancellationToken ct);
    Task RevokeAsync(string? refreshToken, CancellationToken ct);
    Task<IssuedTokens> IssueAndStoreAsync(User user, string? ip, CancellationToken ct);
}

public sealed class TokenService(AppDbContext db, IOptions<JwtOptions> opt) : ITokenService
{
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public IssuedTokens Issue(User user, string? ip)
    {
        var o = opt.Value;
        var now = DateTime.UtcNow;
        var accessExp = now.AddMinutes(o.AccessMinutes);
        var claims = new List<Claim>
        {
            new("sub", user.Id), new("email", user.Email), new("name", user.FullName),
            new("role", user.Role.ToString()), new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.Secret));
        var jwt = new JwtSecurityToken(o.Issuer, o.Audience, claims, now, accessExp, new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var refresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return new IssuedTokens(new JwtSecurityTokenHandler().WriteToken(jwt), accessExp, refresh, now.AddHours(o.RefreshHours));
    }

    public async Task<IssuedTokens> IssueAndStoreAsync(User user, string? ip, CancellationToken ct)
    {
        var t = Issue(user, ip);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = Hash(t.RefreshToken), ExpiresAtUtc = t.RefreshExpiresUtc, CreatedIp = ip });
        await db.SaveChangesAsync(ct);
        return t;
    }

    /// <summary>Rotating refresh tokens. Presenting an already-revoked token is treated as theft: every session of that user is revoked.</summary>
    public async Task<(User?, IssuedTokens?)> RefreshAsync(string refreshToken, string? ip, CancellationToken ct)
    {
        var h = Hash(refreshToken);
        var row = await db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == h, ct);
        if (row is null) return (null, null);
        var now = DateTime.UtcNow;
        if (row.RevokedAtUtc is not null)
        {
            var all = await db.RefreshTokens.Where(r => r.UserId == row.UserId && r.RevokedAtUtc == null).ToListAsync(ct);
            foreach (var r in all) r.RevokedAtUtc = now;
            await db.SaveChangesAsync(ct);
            return (null, null);
        }
        if (row.ExpiresAtUtc <= now) return (null, null);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == row.UserId && u.IsActive, ct);
        if (user is null) return (null, null);
        row.RevokedAtUtc = now;
        var tokens = await IssueAndStoreAsync(user, ip, ct);
        return (user, tokens);
    }

    public async Task RevokeAsync(string? refreshToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(refreshToken)) return;
        var h = Hash(refreshToken);
        var row = await db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == h && r.RevokedAtUtc == null, ct);
        if (row is null) return;
        row.RevokedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
