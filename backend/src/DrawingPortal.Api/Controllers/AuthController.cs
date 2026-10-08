using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using DrawingPortal.Api.Options;
using DrawingPortal.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DrawingPortal.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(IOtpService otp, ITokenService tokens, AppDbContext db, ICurrentUser me) : ControllerBase
{
    public const string AccessCookie = "dp_at", RefreshCookie = "dp_rt";
    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.FullName, u.Department, u.Role.ToString(), u.IsActive, u.LastLoginAtUtc, u.CreatedAtUtc);

    private void SetCookies(IssuedTokens t)
    {
        CookieOptions Opt(DateTime exp, string path) => new() { HttpOnly = true, Secure = Request.IsHttps, SameSite = SameSiteMode.Strict, Path = path, Expires = exp, IsEssential = true };
        Response.Cookies.Append(AccessCookie, t.AccessToken, Opt(t.AccessExpiresUtc, "/"));
        Response.Cookies.Append(RefreshCookie, t.RefreshToken, Opt(t.RefreshExpiresUtc, "/api/auth"));
    }
    private void ClearCookies()
    {
        Response.Cookies.Delete(AccessCookie, new CookieOptions { Path = "/", Secure = Request.IsHttps, SameSite = SameSiteMode.Strict });
        Response.Cookies.Delete(RefreshCookie, new CookieOptions { Path = "/api/auth", Secure = Request.IsHttps, SameSite = SameSiteMode.Strict });
    }

    /// <summary>Always answers the same way, whether or not the address is registered (no account enumeration).</summary>
    [HttpPost("otp/request"), AllowAnonymous, EnableRateLimiting("otp-request")]
    public async Task<IActionResult> RequestOtp(RequestOtpDto dto, CancellationToken ct)
    {
        await otp.RequestAsync(dto.Email, me.Ip, ct);
        return Ok(new { message = "If this e-mail address is registered, a 6-digit sign-in code has been sent." });
    }

    [HttpPost("otp/verify"), AllowAnonymous, EnableRateLimiting("otp-verify")]
    public async Task<ActionResult<UserDto>> VerifyOtp(VerifyOtpDto dto, CancellationToken ct)
    {
        var user = await otp.VerifyAsync(dto.Email, dto.Code, me.Ip, ct);
        if (user is null) return Problem(statusCode: 401, title: "The code is invalid or has expired.");
        SetCookies(await tokens.IssueAndStoreAsync(user, me.Ip, ct));
        return ToDto(user);
    }

    [HttpPost("refresh"), AllowAnonymous]
    public async Task<ActionResult<UserDto>> Refresh(CancellationToken ct)
    {
        var rt = Request.Cookies[RefreshCookie];
        if (string.IsNullOrEmpty(rt)) return Problem(statusCode: 401, title: "Not signed in.");
        var (user, t) = await tokens.RefreshAsync(rt, me.Ip, ct);
        if (user is null || t is null) { ClearCookies(); return Problem(statusCode: 401, title: "Session expired. Please sign in again."); }
        SetCookies(t);
        return ToDto(user);
    }

    [HttpPost("logout"), AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await tokens.RevokeAsync(Request.Cookies[RefreshCookie], ct);
        ClearCookies();
        return NoContent();
    }

    [HttpGet("me"), Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == me.Id && x.IsActive, ct);
        return u is null ? Problem(statusCode: 401, title: "Not signed in.") : ToDto(u);
    }
}
