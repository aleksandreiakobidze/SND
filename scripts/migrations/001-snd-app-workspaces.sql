-- SND app metadata: workspaces, sections, saved agent reports (same database as analytics).
-- Run once with appropriate permissions (CREATE TABLE).

IF OBJECT_ID(N'dbo.SndApp_Workspace', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_Workspace (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_Workspace PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_SndApp_Workspace_SortOrder DEFAULT (0),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_Workspace_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_Workspace_UpdatedAt DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_SndApp_Workspace_User ON dbo.SndApp_Workspace (UserId, SortOrder);
END
GO

IF OBJECT_ID(N'dbo.SndApp_WorkspaceSection', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_WorkspaceSection (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_WorkspaceSection PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    WorkspaceId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_SndApp_WorkspaceSection_SortOrder DEFAULT (0),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_WorkspaceSection_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_WorkspaceSection_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SndApp_Section_Workspace FOREIGN KEY (WorkspaceId)
      REFERENCES dbo.SndApp_Workspace (Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_SndApp_Section_Workspace ON dbo.SndApp_WorkspaceSection (WorkspaceId, SortOrder);
END
GO

IF OBJECT_ID(N'dbo.SndApp_SavedReport', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_SavedReport (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_SavedReport PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    SectionId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(500) NOT NULL,
    Source VARCHAR(20) NOT NULL,
    Prompt NVARCHAR(MAX) NULL,
    SqlText NVARCHAR(MAX) NULL,
    ChartConfigJson NVARCHAR(MAX) NULL,
    Narrative NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_SavedReport_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_SavedReport_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SndApp_Report_Section FOREIGN KEY (SectionId)
      REFERENCES dbo.SndApp_WorkspaceSection (Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_SndApp_Report_Section ON dbo.SndApp_SavedReport (SectionId);
END
GO
