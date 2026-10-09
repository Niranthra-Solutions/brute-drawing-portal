using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Controllers;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Options;
using DrawingPortal.Api.Security;
using DrawingPortal.Api.Services;
using DrawingPortal.Api.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog((ctx, cfg) => cfg
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore", Serilog.Events.LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File(Path.Combine(ctx.HostingEnvironment.ContentRootPath, "logs", "portal-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30, shared: true));
    builder.WebHost.ConfigureKestrel(k => { k.AddServerHeader = false; k.Limits.MaxRequestBodySize = 215_000_000; });

    var cfg = builder.Configuration;
    builder.Services.Configure<DatabaseOptions>(cfg.GetSection(DatabaseOptions.Section));
    builder.Services.Configure<JwtOptions>(cfg.GetSection(JwtOptions.Section));
    builder.Services.Configure<AuthOptions>(cfg.GetSection(AuthOptions.Section));
    builder.Services.Configure<EmailOptions>(cfg.GetSection(EmailOptions.Section));
    builder.Services.Configure<StorageOptions>(cfg.GetSection(StorageOptions.Section));
    builder.Services.Configure<PortalOptions>(cfg.GetSection(PortalOptions.Section));
    builder.Services.Configure<BulkOptions>(cfg.GetSection(BulkOptions.Section));
    builder.Services.Configure<WorkerOptions>(cfg.GetSection(WorkerOptions.Section));

    var jwt = cfg.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
    if (builder.Environment.IsProduction() && (jwt.Secret.Length < 32 || jwt.Secret.Contains("CHANGE-ME", StringComparison.OrdinalIgnoreCase)))
        throw new InvalidOperationException("Jwt:Secret must be set to a random value of at least 32 characters in Production (use the Jwt__Secret environment variable).");
    if (jwt.Secret.Length < 32) throw new InvalidOperationException("Jwt:Secret must be at least 32 characters.");
    var dbOpt = cfg.GetSection(DatabaseOptions.Section).Get<DatabaseOptions>() ?? new DatabaseOptions();

    // ---------------- data
    builder.Services.AddDbContext<AppDbContext>(o =>
    {
        var cs = cfg.GetConnectionString("Default") ?? throw new InvalidOperationException("ConnectionStrings:Default is missing.");
        if (dbOpt.Provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)) o.UseSqlite(cs);
        else o.UseSqlServer(cs, s => { s.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null); s.CommandTimeout(30); });
    });
    builder.Services.AddMemoryCache();
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddSingleton<ICacheVersion, CacheVersion>();
    builder.Services.AddSingleton<BulkImportQueue>();
    builder.Services.AddSingleton<EmailSignal>();

    // ---------------- application services
    builder.Services.AddScoped<ICurrentUser, CurrentUser>();
    builder.Services.AddScoped<IAuditService, AuditService>();
    builder.Services.AddScoped<INotifier, Notifier>();
    builder.Services.AddScoped<ISettingsService, SettingsService>();
    builder.Services.AddScoped<ILookupService, LookupService>();
    builder.Services.AddScoped<IMasterDataService, MasterDataService>();
    builder.Services.AddScoped<IFileStorage, FileStorage>();
    builder.Services.AddScoped<IRequestService, RequestService>();
    builder.Services.AddScoped<IRequestWorkflow>(sp => sp.GetRequiredService<IRequestService>());
    builder.Services.AddScoped<IDrawingService, DrawingService>();
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IDocumentService, DocumentService>();
    builder.Services.AddScoped<IBulkImportService, BulkImportService>();
    builder.Services.AddScoped<NotificationService>();
    builder.Services.AddScoped<AuditQueryService>();
    builder.Services.AddScoped<DashboardService>();
    builder.Services.AddScoped<IOtpService, OtpService>();
    builder.Services.AddScoped<ITokenService, TokenService>();
    builder.Services.AddScoped<EmailOutboxProcessor>();
    builder.Services.AddScoped<DbSeeder>();
    var mail = cfg.GetSection(EmailOptions.Section).Get<EmailOptions>() ?? new EmailOptions();
    if (mail.Mode.Equals("Smtp", StringComparison.OrdinalIgnoreCase)) builder.Services.AddSingleton<IEmailTransport, SmtpEmailTransport>();
    else builder.Services.AddSingleton<IEmailTransport, FileEmailTransport>();
    builder.Services.AddHostedService<EmailOutboxWorker>();
    builder.Services.AddHostedService<BulkImportWorker>();
    builder.Services.AddHostedService<MaintenanceWorker>();

    // ---------------- web
    builder.Services.AddExceptionHandler<ApiExceptionHandler>();
    builder.Services.AddProblemDetails();
    builder.Services.AddControllers()
        .AddJsonOptions(o => { o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()); o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never; })
        .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
        {
            var errors = ctx.ModelState.Where(kv => kv.Value?.Errors.Count > 0).ToDictionary(
                kv => string.Join('.', kv.Key.Split('.').Select(p => p.Length == 0 ? p : char.ToLowerInvariant(p[0]) + p[1..])),
                kv => kv.Value!.Errors.Select(e => string.IsNullOrEmpty(e.ErrorMessage) ? "Invalid value." : e.ErrorMessage).ToArray());
            return new ObjectResult(new ValidationProblemDetails(errors) { Status = 422, Title = "One or more validation errors occurred." }) { StatusCode = 422, ContentTypes = { "application/problem+json" } };
        });
    builder.Services.AddResponseCompression(o =>
    {
        o.EnableForHttps = true; o.Providers.Add<BrotliCompressionProvider>(); o.Providers.Add<GzipCompressionProvider>();
        o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["image/svg+xml", "application/problem+json"]);
    });
    if (builder.Configuration.GetValue<bool>("Portal:TrustForwardedHeaders"))
        builder.Services.Configure<ForwardedHeadersOptions>(o => { o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto; o.KnownNetworks.Clear(); o.KnownProxies.Clear(); });

    // ---------------- authentication / authorization (JWT carried in an HttpOnly, SameSite=Strict cookie)
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
            RoleClaimType = "role",
            NameClaimType = "name",
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        };
        o.Events = new JwtBearerEvents { OnMessageReceived = c => { c.Token = c.Request.Cookies[AuthController.AccessCookie]; return Task.CompletedTask; } };
    });
    builder.Services.AddAuthorizationBuilder()
        .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())   // secure by default
        .AddPolicy(Policies.Admin, p => p.RequireRole("Admin"));

    // ---------------- rate limiting
    string Key(HttpContext c) => c.User.FindFirst("sub")?.Value ?? c.Connection.RemoteIpAddress?.ToString() ?? "anon";
    builder.Services.AddRateLimiter(o =>
    {
        o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        var rl = builder.Configuration.GetSection("RateLimit");
        FixedWindowRateLimiterOptions W(int permit, int minutes) => new() { PermitLimit = permit, Window = TimeSpan.FromMinutes(minutes), QueueLimit = 0 };
        o.AddPolicy("otp-request", c => RateLimitPartition.GetFixedWindowLimiter("otpq:" + (c.Connection.RemoteIpAddress?.ToString() ?? "anon"), _ => W(rl.GetValue("OtpRequestPer15Min", 10), 15)));
        o.AddPolicy("otp-verify", c => RateLimitPartition.GetFixedWindowLimiter("otpv:" + (c.Connection.RemoteIpAddress?.ToString() ?? "anon"), _ => W(rl.GetValue("OtpVerifyPer15Min", 30), 15)));
        o.AddPolicy("upload", c => RateLimitPartition.GetFixedWindowLimiter("up:" + Key(c), _ => W(rl.GetValue("UploadsPer10Min", 120), 10)));
        o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c => RateLimitPartition.GetFixedWindowLimiter("g:" + Key(c), _ => W(rl.GetValue("RequestsPerMinute", 900), 1)));
    });

    var app = builder.Build();

    // ---------------- startup: database + seed
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var opt = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        if (opt.AutoMigrate)
        {
            if (opt.Provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
            {
                var file = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder(cfg.GetConnectionString("Default")).DataSource;
                if (!string.IsNullOrEmpty(file) && Path.GetDirectoryName(Path.GetFullPath(file)) is { } dir) Directory.CreateDirectory(dir);
                await db.Database.EnsureCreatedAsync();
            }
            else await db.Database.MigrateAsync();
        }
        await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
        var auth = scope.ServiceProvider.GetRequiredService<IOptions<AuthOptions>>().Value;
        if (auth.TestAdmin.Enabled)
            app.Logger.LogWarning("TEST ADMIN ACCOUNT '{Email}' IS ENABLED with a fixed one-time code. Set Auth:TestAdmin:Enabled=false before go-live.", auth.TestAdmin.Email);
        if (mail.Mode.Equals("File", StringComparison.OrdinalIgnoreCase))
            app.Logger.LogWarning("E-mail mode is 'File': messages are written to {Path} and NOT sent. Set Email:Mode=Smtp and real SMTP settings for delivery.", mail.FileDropPath);
    }

    // ---------------- pipeline
    if (builder.Configuration.GetValue<bool>("Portal:TrustForwardedHeaders")) app.UseForwardedHeaders();
    app.UseExceptionHandler();
    app.UseMiddleware<SecurityHeadersMiddleware>();
    if (!app.Environment.IsDevelopment()) app.UseHsts();
    app.UseResponseCompression();
    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = c =>
        {
            var h = c.Context.Response.Headers;
            h.CacheControl = c.Context.Request.Path.StartsWithSegments("/assets") ? "public, max-age=31536000, immutable" : "no-cache";
        }
    });
    app.UseRouting();
    app.UseRateLimiter();
    app.UseMiddleware<CsrfGuardMiddleware>();
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapGet("/health", async (AppDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503)).AllowAnonymous();
    app.MapFallback("/api/{**path}", (HttpContext c) => Results.Problem(statusCode: 404, title: "Endpoint not found.")).AllowAnonymous();
    app.MapFallbackToFile("{*path:nonfile}", "index.html").AllowAnonymous();   // SPA deep links: any valid client route works after sign-in

    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
    throw;
}
finally { Log.CloseAndFlush(); }

public partial class Program { }
