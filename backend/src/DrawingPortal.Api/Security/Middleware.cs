namespace DrawingPortal.Api.Security;

/// <summary>
/// CSRF defence in depth: auth cookies are SameSite=Strict AND every state-changing /api request must carry a custom header.
/// A cross-site form or fetch cannot set this header without a CORS pre-flight, which this API never allows.
/// </summary>
public sealed class CsrfGuardMiddleware(RequestDelegate next)
{
    public const string Header = "X-Requested-With";
    public const string Value = "XMLHttpRequest";
    public async Task Invoke(HttpContext ctx)
    {
        var m = ctx.Request.Method;
        if (ctx.Request.Path.StartsWithSegments("/api") && (HttpMethods.IsPost(m) || HttpMethods.IsPut(m) || HttpMethods.IsDelete(m) || HttpMethods.IsPatch(m))
            && ctx.Request.Headers[Header] != Value)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            await ctx.Response.WriteAsJsonAsync(new { title = "Missing anti-forgery header.", status = 403 });
            return;
        }
        await next(ctx);
    }
}

public sealed class SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
{
    public Task Invoke(HttpContext ctx)
    {
        ctx.Response.OnStarting(() =>
        {
            var h = ctx.Response.Headers;
            h["X-Content-Type-Options"] = "nosniff";
            h["X-Frame-Options"] = "SAMEORIGIN";
            h["Referrer-Policy"] = "strict-origin-when-cross-origin";
            h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
            h["Cross-Origin-Opener-Policy"] = "same-origin";
            h.Remove("Server"); h.Remove("X-Powered-By");
            if (!ctx.Request.Path.StartsWithSegments("/api"))
                h["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
                                               "connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
            if (ctx.Request.IsHttps && !env.IsDevelopment()) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            if (ctx.Request.Path.StartsWithSegments("/api") && !h.ContainsKey("Cache-Control")) h["Cache-Control"] = "no-store";
            return Task.CompletedTask;
        });
        return next(ctx);
    }
}
