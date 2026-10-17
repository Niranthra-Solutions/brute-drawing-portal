using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace DrawingPortal.Tests;

public sealed class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    public string? DbName { get; }
    public string Root { get; } = Path.Combine(Path.GetTempPath(), "dp-tests-" + Guid.NewGuid().ToString("N"));
    public const string AdminEmail = "admin@drawingportal.test";

    public ApiFixture()
    {
        Directory.CreateDirectory(Root);
        // Environment variables are read by Program.cs before the host is built, so they reliably override configuration.
        void Set(string k, string v) => Environment.SetEnvironmentVariable(k, v);
        // DP_TEST_SQLSERVER="Server=...;User Id=sa;Password=...;TrustServerCertificate=True" runs the SAME suite against real SQL Server
        // (a throw-away database is created through the EF migration, then dropped). Default: SQLite.
        var sql = Environment.GetEnvironmentVariable("DP_TEST_SQLSERVER");
        if (!string.IsNullOrWhiteSpace(sql)) { DbName = "dp_test_" + Guid.NewGuid().ToString("N")[..12]; Set("Database__Provider", "SqlServer"); Set("ConnectionStrings__Default", sql + ";Database=" + DbName); }
        else { Set("Database__Provider", "Sqlite"); Set("ConnectionStrings__Default", $"Data Source={Path.Combine(Root, "test.db")}"); }
        Set("Storage__RootPath", Path.Combine(Root, "files")); Set("Email__FileDropPath", Path.Combine(Root, "mail"));
        Set("Workers__Enabled", "false"); Set("Jwt__Secret", "integration-test-secret-0123456789-0123456789-abcdef");
        Set("Auth__TestAdmin__Enabled", "true"); Set("Portal__SeedSampleData", "true"); Set("Portal__PublicBaseUrl", "http://portal.test");
        Set("RateLimit__OtpRequestPer15Min", "100000"); Set("RateLimit__OtpVerifyPer15Min", "100000"); Set("Bulk__BatchDelayMs", "0"); Set("Bulk__BatchSize", "3");
    }

    public HttpClient NewClient()
    {
        var c = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add("X-Requested-With", "XMLHttpRequest");
        return c;
    }

    public async Task<HttpClient> LoginAdminAsync()
    {
        var c = NewClient();
        (await c.PostAsJsonAsync("/api/auth/otp/request", new { email = AdminEmail })).EnsureSuccessStatusCode();
        (await c.PostAsJsonAsync("/api/auth/otp/verify", new { email = AdminEmail, code = "123456" })).EnsureSuccessStatusCode();
        return c;
    }

    /// <summary>Real e-mail OTP flow: request a code, read it from the outbox (the test stand-in for the user's inbox), verify.</summary>
    public async Task<HttpClient> LoginWithEmailOtpAsync(string email)
    {
        var c = NewClient();
        (await c.PostAsJsonAsync("/api/auth/otp/request", new { email })).EnsureSuccessStatusCode();
        string code;
        using (var scope = Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var body = await db.EmailOutbox.Where(e => e.ToAddress == email && e.Category == "Otp").OrderByDescending(e => e.CreatedAtUtc).Select(e => e.TextBody).FirstAsync();
            code = Regex.Match(body, @"Code: (\d{6})").Groups[1].Value;
        }
        var r = await c.PostAsJsonAsync("/api/auth/otp/verify", new { email, code });
        r.EnsureSuccessStatusCode();
        return c;
    }

    public async Task<T> Scoped<T>(Func<IServiceProvider, Task<T>> f) { using var s = Services.CreateScope(); return await f(s.ServiceProvider); }

    public Task InitializeAsync() => Task.CompletedTask;
    async Task IAsyncLifetime.DisposeAsync()
    {
        if (DbName is not null) { try { using var s = Services.CreateScope(); await s.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync(); } catch { } }
        try { Directory.Delete(Root, true); } catch { }
    }
}

public static class HttpExt
{
    public static async Task<T> Ok<T>(this Task<HttpResponseMessage> t)
    {
        var r = await t;
        var text = await r.Content.ReadAsStringAsync();
        Assert.True(r.IsSuccessStatusCode, $"{(int)r.StatusCode} {r.RequestMessage?.RequestUri}: {text}");
        return JsonSerializer.Deserialize<T>(text, ApiFixture.Json)!;
    }
    public static async Task<HttpResponseMessage> Status(this Task<HttpResponseMessage> t, int expected)
    {
        var r = await t;
        Assert.True((int)r.StatusCode == expected, $"expected {expected} but got {(int)r.StatusCode}: {await r.Content.ReadAsStringAsync()}");
        return r;
    }
    public static MultipartFormDataContent File(string name, byte[] bytes, string field = "file")
    {
        var m = new MultipartFormDataContent();
        var part = new ByteArrayContent(bytes); part.Headers.ContentType = new("application/octet-stream");
        m.Add(part, field, name);
        return m;
    }
}
