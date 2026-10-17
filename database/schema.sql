IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [AhRatings] (
        [Id] varchar(32) NOT NULL,
        [Value] int NOT NULL,
        [Standard] nvarchar(20) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_AhRatings] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] varchar(32) NOT NULL,
        [ActorId] varchar(32) NULL,
        [ActorEmail] nvarchar(254) NOT NULL,
        [Action] nvarchar(60) NOT NULL,
        [EntityType] nvarchar(60) NOT NULL,
        [EntityId] varchar(32) NULL,
        [Summary] nvarchar(500) NOT NULL,
        [DetailsJson] nvarchar(max) NULL,
        [IpAddress] varchar(64) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [BulkErrors] (
        [Id] bigint NOT NULL IDENTITY,
        [JobId] varchar(32) NOT NULL,
        [RowNumber] int NOT NULL,
        [DrawingNumber] nvarchar(60) NULL,
        [Message] nvarchar(500) NOT NULL,
        CONSTRAINT [PK_BulkErrors] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [BulkJobs] (
        [Id] varchar(32) NOT NULL,
        [Status] varchar(24) NOT NULL,
        [OriginalFileName] nvarchar(255) NOT NULL,
        [TempPath] nvarchar(400) NOT NULL,
        [RequestedById] varchar(32) NOT NULL,
        [SkipDuplicates] bit NOT NULL,
        [AutoCreateMaster] bit NOT NULL,
        [TotalRows] int NOT NULL,
        [ProcessedRows] int NOT NULL,
        [CreatedCount] int NOT NULL,
        [SkippedCount] int NOT NULL,
        [ErrorCount] int NOT NULL,
        [FailureMessage] nvarchar(1000) NULL,
        [StartedAtUtc] datetime2 NULL,
        [FinishedAtUtc] datetime2 NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_BulkJobs] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Categories] (
        [Id] varchar(32) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_Categories] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Connectors] (
        [Id] varchar(32) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_Connectors] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [EmailOutbox] (
        [Id] varchar(32) NOT NULL,
        [ToAddress] nvarchar(254) NOT NULL,
        [ToName] nvarchar(120) NULL,
        [Subject] nvarchar(300) NOT NULL,
        [HtmlBody] nvarchar(max) NOT NULL,
        [TextBody] nvarchar(max) NOT NULL,
        [Category] nvarchar(40) NOT NULL,
        [Status] varchar(24) NOT NULL,
        [Attempts] int NOT NULL,
        [NextAttemptAtUtc] datetime2 NOT NULL,
        [SentAtUtc] datetime2 NULL,
        [LastError] nvarchar(1000) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_EmailOutbox] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Files] (
        [Id] varchar(32) NOT NULL,
        [Kind] varchar(24) NOT NULL,
        [OriginalName] nvarchar(255) NOT NULL,
        [StoredPath] nvarchar(400) NOT NULL,
        [ContentType] varchar(120) NOT NULL,
        [Extension] varchar(12) NOT NULL,
        [SizeBytes] bigint NOT NULL,
        [Sha256] varchar(64) NOT NULL,
        [Url] varchar(120) NOT NULL,
        [UploadedById] varchar(32) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Files] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Makes] (
        [Id] varchar(32) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_Makes] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Settings] (
        [Key] nvarchar(100) NOT NULL,
        [Value] nvarchar(2000) NOT NULL,
        [UpdatedAtUtc] datetime2 NOT NULL,
        [UpdatedBy] nvarchar(200) NULL,
        CONSTRAINT [PK_Settings] PRIMARY KEY ([Key])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [TicketCounters] (
        [Prefix] nvarchar(4) NOT NULL,
        [Year] int NOT NULL,
        [LastValue] int NOT NULL,
        [Version] int NOT NULL,
        CONSTRAINT [PK_TicketCounters] PRIMARY KEY ([Prefix], [Year])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Users] (
        [Id] varchar(32) NOT NULL,
        [Email] nvarchar(254) NOT NULL,
        [FullName] nvarchar(120) NOT NULL,
        [Department] nvarchar(120) NULL,
        [Role] varchar(24) NOT NULL,
        [IsActive] bit NOT NULL,
        [LastLoginAtUtc] datetime2 NULL,
        [FailedOtpAttempts] int NOT NULL,
        [LockoutUntilUtc] datetime2 NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [VehicleTypes] (
        [Id] varchar(32) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_VehicleTypes] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Voltages] (
        [Id] varchar(32) NOT NULL,
        [ValueV] int NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Voltages] PRIMARY KEY NONCLUSTERED ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Documents] (
        [Id] varchar(32) NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Category] nvarchar(80) NOT NULL,
        [Description] nvarchar(1000) NULL,
        [FileId] varchar(32) NOT NULL,
        [UploadedById] varchar(32) NULL,
        [IsDeleted] bit NOT NULL,
        [UpdatedAtUtc] datetime2 NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Documents] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Documents_Files_FileId] FOREIGN KEY ([FileId]) REFERENCES [Files] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Notifications] (
        [Id] varchar(32) NOT NULL,
        [UserId] varchar(32) NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Message] nvarchar(1000) NOT NULL,
        [LinkPath] varchar(300) NULL,
        [IsRead] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Notifications] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Notifications_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [OtpChallenges] (
        [Id] varchar(32) NOT NULL,
        [UserId] varchar(32) NOT NULL,
        [CodeHash] varchar(64) NOT NULL,
        [ExpiresAtUtc] datetime2 NOT NULL,
        [Attempts] int NOT NULL,
        [ConsumedAtUtc] datetime2 NULL,
        [RequestIp] varchar(64) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_OtpChallenges] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_OtpChallenges_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [RefreshTokens] (
        [Id] varchar(32) NOT NULL,
        [UserId] varchar(32) NOT NULL,
        [TokenHash] varchar(64) NOT NULL,
        [ExpiresAtUtc] datetime2 NOT NULL,
        [RevokedAtUtc] datetime2 NULL,
        [CreatedIp] varchar(64) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_RefreshTokens_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Models] (
        [Id] varchar(32) NOT NULL,
        [MakeId] varchar(32) NOT NULL,
        [VehicleTypeId] varchar(32) NOT NULL,
        [CategoryId] varchar(32) NOT NULL,
        [ModelName] nvarchar(120) NOT NULL,
        [Capacity] nvarchar(40) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Models] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Models_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Models_Makes_MakeId] FOREIGN KEY ([MakeId]) REFERENCES [Makes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Models_VehicleTypes_VehicleTypeId] FOREIGN KEY ([VehicleTypeId]) REFERENCES [VehicleTypes] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Drawings] (
        [Id] varchar(32) NOT NULL,
        [DrawingNumber] varchar(40) NOT NULL,
        [ModelId] varchar(32) NOT NULL,
        [VoltageV] int NOT NULL,
        [AhValue] int NOT NULL,
        [AhStandard] nvarchar(20) NOT NULL,
        [LengthMm] int NOT NULL,
        [WidthMm] int NOT NULL,
        [HeightMm] int NOT NULL,
        [ConnectorTypeId] varchar(32) NOT NULL,
        [Comments] nvarchar(2000) NULL,
        [CompetitorDrawingNumber] nvarchar(60) NULL,
        [Status] varchar(24) NOT NULL,
        [CurrentRevisionNo] int NOT NULL,
        [CurrentFileId] varchar(32) NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAtUtc] datetime2 NULL,
        [DeletedById] varchar(32) NULL,
        [CreatedById] varchar(32) NULL,
        [UpdatedAtUtc] datetime2 NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Drawings] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Drawings_Connectors_ConnectorTypeId] FOREIGN KEY ([ConnectorTypeId]) REFERENCES [Connectors] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Drawings_Files_CurrentFileId] FOREIGN KEY ([CurrentFileId]) REFERENCES [Files] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Drawings_Models_ModelId] FOREIGN KEY ([ModelId]) REFERENCES [Models] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Requests] (
        [Id] varchar(32) NOT NULL,
        [TicketNo] varchar(24) NOT NULL,
        [Type] varchar(24) NOT NULL,
        [Status] varchar(24) NOT NULL,
        [Priority] varchar(24) NOT NULL,
        [RequestedById] varchar(32) NOT NULL,
        [AssignedToId] varchar(32) NULL,
        [Title] nvarchar(200) NOT NULL,
        [RelatedDrawingId] varchar(32) NULL,
        [CategoryName] nvarchar(200) NULL,
        [VehicleTypeName] nvarchar(200) NULL,
        [MakeName] nvarchar(200) NULL,
        [ModelName] nvarchar(120) NULL,
        [Capacity] nvarchar(40) NULL,
        [VoltageV] int NULL,
        [AhValue] int NULL,
        [AhStandard] nvarchar(20) NULL,
        [LengthMm] int NULL,
        [WidthMm] int NULL,
        [HeightMm] int NULL,
        [ConnectorName] nvarchar(200) NULL,
        [ChangeType] nvarchar(40) NULL,
        [TargetDateUtc] datetime2 NULL,
        [Description] nvarchar(4000) NULL,
        [Reason] nvarchar(2000) NULL,
        [SubmittedAtUtc] datetime2 NOT NULL,
        [UpdatedAtUtc] datetime2 NOT NULL,
        [ClosedAtUtc] datetime2 NULL,
        [ClosureNote] nvarchar(2000) NULL,
        [ResultDrawingId] varchar(32) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Requests] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Requests_Drawings_RelatedDrawingId] FOREIGN KEY ([RelatedDrawingId]) REFERENCES [Drawings] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Requests_Drawings_ResultDrawingId] FOREIGN KEY ([ResultDrawingId]) REFERENCES [Drawings] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Requests_Users_AssignedToId] FOREIGN KEY ([AssignedToId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Requests_Users_RequestedById] FOREIGN KEY ([RequestedById]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Revisions] (
        [Id] varchar(32) NOT NULL,
        [DrawingId] varchar(32) NOT NULL,
        [RevisionNo] int NOT NULL,
        [DrawingNumber] varchar(40) NOT NULL,
        [FileId] varchar(32) NULL,
        [ChangeNotes] nvarchar(2000) NULL,
        [SnapshotJson] nvarchar(4000) NULL,
        [CreatedById] varchar(32) NULL,
        [RequestId] varchar(32) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Revisions] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Revisions_Drawings_DrawingId] FOREIGN KEY ([DrawingId]) REFERENCES [Drawings] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Revisions_Files_FileId] FOREIGN KEY ([FileId]) REFERENCES [Files] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [Comments] (
        [Id] varchar(32) NOT NULL,
        [RequestId] varchar(32) NOT NULL,
        [AuthorId] varchar(32) NOT NULL,
        [Body] nvarchar(4000) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_Comments] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_Comments_Requests_RequestId] FOREIGN KEY ([RequestId]) REFERENCES [Requests] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Comments_Users_AuthorId] FOREIGN KEY ([AuthorId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [RequestAttachments] (
        [Id] varchar(32) NOT NULL,
        [RequestId] varchar(32) NOT NULL,
        [FileId] varchar(32) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_RequestAttachments] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_RequestAttachments_Files_FileId] FOREIGN KEY ([FileId]) REFERENCES [Files] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RequestAttachments_Requests_RequestId] FOREIGN KEY ([RequestId]) REFERENCES [Requests] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE TABLE [RequestEvents] (
        [Id] varchar(32) NOT NULL,
        [RequestId] varchar(32) NOT NULL,
        [ActorId] varchar(32) NULL,
        [Action] nvarchar(40) NOT NULL,
        [FromStatus] nvarchar(24) NULL,
        [ToStatus] nvarchar(24) NULL,
        [Note] nvarchar(2000) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_RequestEvents] PRIMARY KEY NONCLUSTERED ([Id]),
        CONSTRAINT [FK_RequestEvents_Requests_RequestId] FOREIGN KEY ([RequestId]) REFERENCES [Requests] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_RequestEvents_Users_ActorId] FOREIGN KEY ([ActorId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_AhRatings_CreatedAtUtc_Id] ON [AhRatings] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_AhRatings_Value_Standard] ON [AhRatings] ([Value], [Standard]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_ActorId] ON [AuditLogs] ([ActorId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_CreatedAtUtc] ON [AuditLogs] ([CreatedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_AuditLogs_CreatedAtUtc_Id] ON [AuditLogs] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_EntityType_EntityId] ON [AuditLogs] ([EntityType], [EntityId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_BulkErrors_JobId_RowNumber] ON [BulkErrors] ([JobId], [RowNumber]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_BulkJobs_CreatedAtUtc_Id] ON [BulkJobs] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Categories_CreatedAtUtc_Id] ON [Categories] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Categories_Name] ON [Categories] ([Name]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Comments_AuthorId] ON [Comments] ([AuthorId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Comments_CreatedAtUtc_Id] ON [Comments] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Comments_RequestId_CreatedAtUtc] ON [Comments] ([RequestId], [CreatedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Connectors_CreatedAtUtc_Id] ON [Connectors] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Connectors_Name] ON [Connectors] ([Name]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Documents_Category] ON [Documents] ([Category]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Documents_CreatedAtUtc_Id] ON [Documents] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Documents_FileId] ON [Documents] ([FileId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Documents_Title] ON [Documents] ([Title]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Drawings_ConnectorTypeId] ON [Drawings] ([ConnectorTypeId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Drawings_CreatedAtUtc_Id] ON [Drawings] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Drawings_CurrentFileId] ON [Drawings] ([CurrentFileId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Drawings_DrawingNumber] ON [Drawings] ([DrawingNumber]) WHERE [IsDeleted] = 0');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Drawings_ModelId_VoltageV_AhValue] ON [Drawings] ([ModelId], [VoltageV], [AhValue]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Drawings_Status_IsDeleted] ON [Drawings] ([Status], [IsDeleted]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Drawings_UpdatedAtUtc] ON [Drawings] ([UpdatedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Drawings_VoltageV_LengthMm_WidthMm_HeightMm] ON [Drawings] ([VoltageV], [LengthMm], [WidthMm], [HeightMm]) INCLUDE ([AhValue], [ModelId], [Status]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_EmailOutbox_CreatedAtUtc_Id] ON [EmailOutbox] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_EmailOutbox_Status_NextAttemptAtUtc] ON [EmailOutbox] ([Status], [NextAttemptAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Files_CreatedAtUtc_Id] ON [Files] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Files_Sha256] ON [Files] ([Sha256]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Makes_CreatedAtUtc_Id] ON [Makes] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Makes_Name] ON [Makes] ([Name]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Models_CategoryId] ON [Models] ([CategoryId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Models_CreatedAtUtc_Id] ON [Models] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Models_MakeId_VehicleTypeId] ON [Models] ([MakeId], [VehicleTypeId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Models_MakeId_VehicleTypeId_CategoryId_ModelName_Capacity] ON [Models] ([MakeId], [VehicleTypeId], [CategoryId], [ModelName], [Capacity]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Models_VehicleTypeId] ON [Models] ([VehicleTypeId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Notifications_CreatedAtUtc_Id] ON [Notifications] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Notifications_UserId_IsRead_CreatedAtUtc] ON [Notifications] ([UserId], [IsRead], [CreatedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_OtpChallenges_CreatedAtUtc_Id] ON [OtpChallenges] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_OtpChallenges_UserId_CreatedAtUtc] ON [OtpChallenges] ([UserId], [CreatedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_RefreshTokens_CreatedAtUtc_Id] ON [RefreshTokens] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RefreshTokens_TokenHash] ON [RefreshTokens] ([TokenHash]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RefreshTokens_UserId] ON [RefreshTokens] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_RequestAttachments_CreatedAtUtc_Id] ON [RequestAttachments] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RequestAttachments_FileId] ON [RequestAttachments] ([FileId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RequestAttachments_RequestId] ON [RequestAttachments] ([RequestId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RequestEvents_ActorId] ON [RequestEvents] ([ActorId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_RequestEvents_CreatedAtUtc_Id] ON [RequestEvents] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RequestEvents_RequestId_CreatedAtUtc] ON [RequestEvents] ([RequestId], [CreatedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Requests_AssignedToId] ON [Requests] ([AssignedToId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Requests_CreatedAtUtc_Id] ON [Requests] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Requests_RelatedDrawingId] ON [Requests] ([RelatedDrawingId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Requests_RequestedById_SubmittedAtUtc] ON [Requests] ([RequestedById], [SubmittedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Requests_ResultDrawingId] ON [Requests] ([ResultDrawingId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Requests_Status_SubmittedAtUtc] ON [Requests] ([Status], [SubmittedAtUtc]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Requests_TicketNo] ON [Requests] ([TicketNo]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Revisions_CreatedAtUtc_Id] ON [Revisions] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Revisions_DrawingId_RevisionNo] ON [Revisions] ([DrawingId], [RevisionNo]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Revisions_DrawingNumber] ON [Revisions] ([DrawingNumber]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Revisions_FileId] ON [Revisions] ([FileId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Users_CreatedAtUtc_Id] ON [Users] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_VehicleTypes_CreatedAtUtc_Id] ON [VehicleTypes] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_VehicleTypes_Name] ON [VehicleTypes] ([Name]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE CLUSTERED INDEX [IX_Voltages_CreatedAtUtc_Id] ON [Voltages] ([CreatedAtUtc], [Id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Voltages_ValueV] ON [Voltages] ([ValueV]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261005202630_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261005202630_InitialCreate', N'8.0.11');
END;
GO

COMMIT;
GO

