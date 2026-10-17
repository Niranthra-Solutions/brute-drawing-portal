using DrawingPortal.Api.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace DrawingPortal.Api.Security;

/// <summary>Turns every failure into RFC 7807 problem+json. Unexpected errors are logged with a trace id and never leak internals to the client.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        if (ex is OperationCanceledException) { ctx.Response.StatusCode = 499; return true; }
        ProblemDetails p;
        switch (ex)
        {
            case ApiException api:
                p = api.Errors is null ? new ProblemDetails { Status = api.Status, Title = api.Message } : new ValidationProblemDetails(api.Errors) { Status = api.Status, Title = api.Message };
                break;
            case BadHttpRequestException bad:
                p = new ProblemDetails { Status = bad.StatusCode, Title = bad.StatusCode == 413 ? "The upload is too large." : "The request could not be read." };
                break;
            default:
                log.LogError(ex, "Unhandled exception for {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
                p = new ProblemDetails { Status = 500, Title = "An unexpected error occurred. Please try again; if it persists contact support and quote the trace id." };
                break;
        }
        p.Extensions["traceId"] = ctx.TraceIdentifier;
        ctx.Response.StatusCode = p.Status ?? 500;
        // serialise as the RUNTIME type, otherwise the "errors" of a ValidationProblemDetails are dropped
        await ctx.Response.WriteAsJsonAsync(p, p.GetType(), (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json", ct);
        return true;
    }
}