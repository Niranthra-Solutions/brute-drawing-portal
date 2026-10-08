namespace DrawingPortal.Api.Options;

public sealed class DatabaseOptions
{
    public const string Section = "Database";
    /// <summary>SqlServer (default / production) or Sqlite (local trial without SQL Server).</summary>
    public string Provider { get; set; } = "SqlServer";
    public bool AutoMigrate { get; set; } = true;
}

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public string Secret { get; set; } = "";
    public string Issuer { get; set; } = "DrawingPortal";
    public string Audience { get; set; } = "DrawingPortal.Web";
    public int AccessMinutes { get; set; } = 30;
    public int RefreshHours { get; set; } = 8;
}

public sealed class TestAdminOptions
{
    public bool Enabled { get; set; }
    public string Email { get; set; } = "admin@drawingportal.test";
    public string FullName { get; set; } = "Test Admin";
    public string FixedOtp { get; set; } = "123456";
}

public sealed class AuthOptions
{
    public const string Section = "Auth";
    public int OtpMinutes { get; set; } = 5;
    public int OtpMaxAttempts { get; set; } = 5;
    public int ResendCooldownSeconds { get; set; } = 60;
    public int MaxOtpPerHour { get; set; } = 6;
    public int MaxFailuresBeforeLockout { get; set; } = 10;
    public int LockoutMinutes { get; set; } = 15;
    public TestAdminOptions TestAdmin { get; set; } = new();
}

public sealed class SmtpOptions
{
    public string Host { get; set; } = "smtp.example.local";
    public int Port { get; set; } = 587;
    public bool UseStartTls { get; set; } = true;
    /// <summary>Online CRL/OCSP lookup. Off by default: the certificate chain and host name are still validated, but a firewall that blocks revocation servers will not break mail.</summary>
    public bool CheckCertificateRevocation { get; set; }
    public string Username { get; set; } = "dummy-user";
    public string Password { get; set; } = "dummy-password";
}

public sealed class EmailOptions
{
    public const string Section = "Email";
    /// <summary>File = write .eml files to FileDropPath (dev/test). Smtp = real SMTP delivery.</summary>
    public string Mode { get; set; } = "File";
    public string FromAddress { get; set; } = "drawing-portal@example.local";
    public string FromName { get; set; } = "Drawing Portal";
    public string FileDropPath { get; set; } = "App_Data/mail";
    public int MaxAttempts { get; set; } = 8;
    public SmtpOptions Smtp { get; set; } = new();
}

public sealed class StorageOptions
{
    public const string Section = "Storage";
    public string RootPath { get; set; } = "App_Data/files";
    public int MaxDrawingMb { get; set; } = 50;
    public int MaxAttachmentMb { get; set; } = 10;
    public int MaxDocumentMb { get; set; } = 200;
}

public sealed class PortalOptions
{
    public const string Section = "Portal";
    public string PublicBaseUrl { get; set; } = "http://localhost:5080";
    public bool TrustForwardedHeaders { get; set; }
    public bool RequireRequestAttachment { get; set; } = true;
    public bool SeedSampleData { get; set; } = true;
    public int MaxSuggestions { get; set; } = 50;
}

public sealed class BulkOptions
{
    public const string Section = "Bulk";
    public int MaxFileMb { get; set; } = 10;
    public int MaxRows { get; set; } = 50000;
    public int BatchSize { get; set; } = 500;
    public int BatchDelayMs { get; set; } = 20;
}

public sealed class WorkerOptions
{
    public const string Section = "Workers";
    public bool Enabled { get; set; } = true;
}
