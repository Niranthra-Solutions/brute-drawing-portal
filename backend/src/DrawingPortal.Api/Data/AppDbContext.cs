using DrawingPortal.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DrawingPortal.Api.Data;

public sealed class UtcConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

public sealed class NullableUtcConverter() : ValueConverter<DateTime?, DateTime?>(
    v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v : v.Value.ToUniversalTime()) : v,
    v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpChallenge> OtpChallenges => Set<OtpChallenge>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<VehicleCategory> Categories => Set<VehicleCategory>();
    public DbSet<VehicleType> VehicleTypes => Set<VehicleType>();
    public DbSet<Make> Makes => Set<Make>();
    public DbSet<ConnectorType> Connectors => Set<ConnectorType>();
    public DbSet<VoltagePreset> Voltages => Set<VoltagePreset>();
    public DbSet<AhRating> AhRatings => Set<AhRating>();
    public DbSet<VehicleModel> Models => Set<VehicleModel>();
    public DbSet<StoredFile> Files => Set<StoredFile>();
    public DbSet<Drawing> Drawings => Set<Drawing>();
    public DbSet<DrawingRevision> Revisions => Set<DrawingRevision>();
    public DbSet<DrawingRequest> Requests => Set<DrawingRequest>();
    public DbSet<RequestAttachment> RequestAttachments => Set<RequestAttachment>();
    public DbSet<RequestEvent> RequestEvents => Set<RequestEvent>();
    public DbSet<RequestComment> Comments => Set<RequestComment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<EmailOutbox> EmailOutbox => Set<EmailOutbox>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();
    public DbSet<TicketCounter> TicketCounters => Set<TicketCounter>();
    public DbSet<PortalDocument> Documents => Set<PortalDocument>();
    public DbSet<BulkImportJob> BulkJobs => Set<BulkImportJob>();
    public DbSet<BulkImportRowError> BulkErrors => Set<BulkImportRowError>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<DateTime>().HaveConversion<UtcConverter>();
        b.Properties<DateTime?>().HaveConversion<NullableUtcConverter>();
        b.Properties<string>().HaveMaxLength(200);
    }

    protected override void OnModelCreating(ModelBuilder m)
    {
        // ---- Keys: random NanoID PKs are NON-clustered; the clustered index is (CreatedAtUtc, Id), which is
        //      append-mostly and therefore avoids page-split fragmentation caused by random keys on SQL Server.
        foreach (var et in m.Model.GetEntityTypes().Where(t => typeof(Entity).IsAssignableFrom(t.ClrType)).ToList())
        {
            var eb = m.Entity(et.ClrType);
            eb.HasKey("Id").IsClustered(false);
            eb.HasIndex("CreatedAtUtc", "Id").IsUnique().IsClustered();
        }

        // ---- Users / auth
        m.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.FullName).HasMaxLength(120);
            e.Property(x => x.Department).HasMaxLength(120);
        });
        m.Entity<OtpChallenge>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            e.Property(x => x.CodeHash).HasMaxLength(64).IsUnicode(false);
            e.Property(x => x.RequestIp).HasMaxLength(64).IsUnicode(false);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        });
        m.Entity<RefreshToken>(e =>
        {
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.UserId);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsUnicode(false);
            e.Property(x => x.CreatedIp).HasMaxLength(64).IsUnicode(false);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        });

        // ---- Master data
        foreach (var t in new[] { typeof(VehicleCategory), typeof(VehicleType), typeof(Make), typeof(ConnectorType) })
            m.Entity(t).HasIndex("Name").IsUnique();
        m.Entity<VoltagePreset>().HasIndex(x => x.ValueV).IsUnique();
        m.Entity<AhRating>(e => { e.HasIndex(x => new { x.Value, x.Standard }).IsUnique(); e.Property(x => x.Standard).HasMaxLength(20); e.Ignore(x => x.Label); });
        m.Entity<VehicleModel>(e =>
        {
            e.Property(x => x.ModelName).HasMaxLength(120);
            e.Property(x => x.Capacity).HasMaxLength(40);
            e.HasIndex(x => new { x.MakeId, x.VehicleTypeId, x.CategoryId, x.ModelName, x.Capacity }).IsUnique();
            e.HasIndex(x => new { x.MakeId, x.VehicleTypeId });
        });

        // ---- Files / drawings
        m.Entity<StoredFile>(e =>
        {
            e.Property(x => x.OriginalName).HasMaxLength(255);
            e.Property(x => x.StoredPath).HasMaxLength(400);
            e.Property(x => x.ContentType).HasMaxLength(120).IsUnicode(false);
            e.Property(x => x.Extension).HasMaxLength(12).IsUnicode(false);
            e.Property(x => x.Sha256).HasMaxLength(64).IsUnicode(false);
            e.Property(x => x.Url).HasMaxLength(120).IsUnicode(false);
            e.HasIndex(x => x.Sha256);
        });
        m.Entity<Drawing>(e =>
        {
            e.Property(x => x.DrawingNumber).HasMaxLength(40).IsUnicode(false);
            e.Property(x => x.AhStandard).HasMaxLength(20);
            e.Property(x => x.Comments).HasMaxLength(2000);
            e.Property(x => x.CompetitorDrawingNumber).HasMaxLength(60);
            e.Ignore(x => x.AhLabel);
            e.HasIndex(x => x.DrawingNumber).IsUnique().HasFilter("[IsDeleted] = 0");
            // Search path: exact match + dimensional tolerance range scan
            e.HasIndex(x => new { x.VoltageV, x.LengthMm, x.WidthMm, x.HeightMm }).IncludeProperties(x => new { x.AhValue, x.ModelId, x.Status });
            e.HasIndex(x => new { x.ModelId, x.VoltageV, x.AhValue });
            e.HasIndex(x => new { x.Status, x.IsDeleted });
            e.HasIndex(x => x.UpdatedAtUtc);
            e.HasQueryFilter(x => !x.IsDeleted);
            e.HasOne(x => x.Model).WithMany().HasForeignKey(x => x.ModelId);
            e.HasOne(x => x.Connector).WithMany().HasForeignKey(x => x.ConnectorTypeId);
            e.HasOne(x => x.CurrentFile).WithMany().HasForeignKey(x => x.CurrentFileId);
        });
        m.Entity<DrawingRevision>(e =>
        {
            e.Property(x => x.DrawingNumber).HasMaxLength(40).IsUnicode(false);
            e.Property(x => x.ChangeNotes).HasMaxLength(2000);
            e.Property(x => x.SnapshotJson).HasMaxLength(4000);
            e.HasIndex(x => new { x.DrawingId, x.RevisionNo }).IsUnique();
            e.HasIndex(x => x.DrawingNumber);
            e.HasOne(x => x.Drawing).WithMany(d => d.Revisions).HasForeignKey(x => x.DrawingId);
            e.HasOne(x => x.File).WithMany().HasForeignKey(x => x.FileId);
            e.HasQueryFilter(x => !x.Drawing!.IsDeleted);
        });

        // ---- Requests
        m.Entity<DrawingRequest>(e =>
        {
            e.Property(x => x.TicketNo).HasMaxLength(24).IsUnicode(false);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.ModelName).HasMaxLength(120);
            e.Property(x => x.Capacity).HasMaxLength(40);
            e.Property(x => x.AhStandard).HasMaxLength(20);
            e.Property(x => x.ChangeType).HasMaxLength(40);
            e.Property(x => x.Description).HasMaxLength(4000);
            e.Property(x => x.Reason).HasMaxLength(2000);
            e.Property(x => x.ClosureNote).HasMaxLength(2000);
            e.HasIndex(x => x.TicketNo).IsUnique();
            e.HasIndex(x => new { x.RequestedById, x.SubmittedAtUtc });
            e.HasIndex(x => new { x.Status, x.SubmittedAtUtc });
            e.HasIndex(x => x.AssignedToId);
            e.HasOne(x => x.RequestedBy).WithMany().HasForeignKey(x => x.RequestedById);
            e.HasOne(x => x.AssignedTo).WithMany().HasForeignKey(x => x.AssignedToId);
            e.HasOne(x => x.RelatedDrawing).WithMany().HasForeignKey(x => x.RelatedDrawingId);
            e.HasOne(x => x.ResultDrawing).WithMany().HasForeignKey(x => x.ResultDrawingId);
        });
        m.Entity<RequestAttachment>(e =>
        {
            e.HasIndex(x => x.RequestId);
            e.HasOne<DrawingRequest>().WithMany(r => r.Attachments).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.File).WithMany().HasForeignKey(x => x.FileId);
        });
        m.Entity<RequestEvent>(e =>
        {
            e.Property(x => x.Action).HasMaxLength(40);
            e.Property(x => x.FromStatus).HasMaxLength(24);
            e.Property(x => x.ToStatus).HasMaxLength(24);
            e.Property(x => x.Note).HasMaxLength(2000);
            e.HasIndex(x => new { x.RequestId, x.CreatedAtUtc });
            e.HasOne<DrawingRequest>().WithMany(r => r.Events).HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Actor).WithMany().HasForeignKey(x => x.ActorId);
        });
        m.Entity<RequestComment>(e =>
        {
            e.Property(x => x.Body).HasMaxLength(4000);
            e.HasIndex(x => new { x.RequestId, x.CreatedAtUtc });
            e.HasOne<DrawingRequest>().WithMany().HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId);
        });

        // ---- Platform
        m.Entity<Notification>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Message).HasMaxLength(1000);
            e.Property(x => x.LinkPath).HasMaxLength(300).IsUnicode(false);
            e.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAtUtc });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        m.Entity<EmailOutbox>(e =>
        {
            e.Property(x => x.ToAddress).HasMaxLength(254);
            e.Property(x => x.ToName).HasMaxLength(120);
            e.Property(x => x.Subject).HasMaxLength(300);
            e.Property(x => x.HtmlBody).HasMaxLength(int.MaxValue);
            e.Property(x => x.TextBody).HasMaxLength(int.MaxValue);
            e.Property(x => x.Category).HasMaxLength(40);
            e.Property(x => x.LastError).HasMaxLength(1000);
            e.HasIndex(x => new { x.Status, x.NextAttemptAtUtc });
        });
        m.Entity<AuditLog>(e =>
        {
            e.Property(x => x.ActorEmail).HasMaxLength(254);
            e.Property(x => x.Action).HasMaxLength(60);
            e.Property(x => x.EntityType).HasMaxLength(60);
            e.Property(x => x.Summary).HasMaxLength(500);
            e.Property(x => x.DetailsJson).HasMaxLength(int.MaxValue);
            e.Property(x => x.IpAddress).HasMaxLength(64).IsUnicode(false);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasIndex(x => new { x.EntityType, x.EntityId });
            e.HasIndex(x => x.ActorId);
        });
        m.Entity<AppSetting>(e => { e.HasKey(x => x.Key); e.Property(x => x.Key).HasMaxLength(100); e.Property(x => x.Value).HasMaxLength(2000); });
        m.Entity<TicketCounter>(e => { e.HasKey(x => new { x.Prefix, x.Year }); e.Property(x => x.Prefix).HasMaxLength(4); e.Property(x => x.Version).IsConcurrencyToken(); });
        m.Entity<PortalDocument>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Category).HasMaxLength(80);
            e.Property(x => x.Description).HasMaxLength(1000);
            e.HasIndex(x => x.Category);
            e.HasIndex(x => x.Title);
            e.HasQueryFilter(x => !x.IsDeleted);
            e.HasOne(x => x.File).WithMany().HasForeignKey(x => x.FileId);
        });
        m.Entity<BulkImportJob>(e =>
        {
            e.Property(x => x.OriginalFileName).HasMaxLength(255);
            e.Property(x => x.TempPath).HasMaxLength(400);
            e.Property(x => x.FailureMessage).HasMaxLength(1000);
        });
        m.Entity<BulkImportRowError>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedOnAdd();
            e.Property(x => x.JobId).HasMaxLength(32).IsUnicode(false);
            e.Property(x => x.DrawingNumber).HasMaxLength(60);
            e.Property(x => x.Message).HasMaxLength(500);
            e.HasIndex(x => new { x.JobId, x.RowNumber });
        });

        // ---- Global rules: ID columns are short ASCII; enums stored as readable strings; no accidental cascades.
        foreach (var et in m.Model.GetEntityTypes())
        {
            foreach (var p in et.GetProperties())
            {
                if (p.ClrType == typeof(string) && (p.Name == "Id" || p.Name.EndsWith("Id")))
                { p.SetMaxLength(32); p.SetIsUnicode(false); }
                var t = Nullable.GetUnderlyingType(p.ClrType) ?? p.ClrType;
                if (t.IsEnum) { p.SetMaxLength(24); p.SetIsUnicode(false); }
            }
            foreach (var fk in et.GetForeignKeys())
                // Only request children and a user's own notifications cascade; everything else is RESTRICT
                // (SQL Server rejects multiple cascade paths, and master/drawing data must never vanish implicitly).
                fk.DeleteBehavior = fk.PrincipalEntityType.ClrType == typeof(DrawingRequest) || et.ClrType == typeof(Notification)
                    ? DeleteBehavior.Cascade : DeleteBehavior.Restrict;
        }
        foreach (var et in m.Model.GetEntityTypes())
            foreach (var p in et.GetProperties().Where(p => (Nullable.GetUnderlyingType(p.ClrType) ?? p.ClrType).IsEnum))
                p.SetProviderClrType(typeof(string));
    }
}
