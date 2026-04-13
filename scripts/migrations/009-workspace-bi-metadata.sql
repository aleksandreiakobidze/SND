-- Workspace BI: favorites, pins, tags, usage, chart type, tab/section visuals.
-- Run once with appropriate permissions.

-- Saved reports
IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'IsFavorite') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    IsFavorite BIT NOT NULL CONSTRAINT DF_SndApp_SavedReport_IsFavorite DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'IsPinned') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    IsPinned BIT NOT NULL CONSTRAINT DF_SndApp_SavedReport_IsPinned DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'LastOpenedAt') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    LastOpenedAt DATETIME2 NULL;
END
GO

IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'OpenCount') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    OpenCount INT NOT NULL CONSTRAINT DF_SndApp_SavedReport_OpenCount DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'TagsJson') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    TagsJson NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'ChartType') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    ChartType VARCHAR(32) NULL;
END
GO

-- Workspaces (tabs)
IF COL_LENGTH(N'dbo.SndApp_Workspace', N'IconKey') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_Workspace ADD
    IconKey VARCHAR(64) NULL;
END
GO

IF COL_LENGTH(N'dbo.SndApp_Workspace', N'IsPinned') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_Workspace ADD
    IsPinned BIT NOT NULL CONSTRAINT DF_SndApp_Workspace_IsPinned DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.SndApp_Workspace', N'AccentColor') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_Workspace ADD
    AccentColor VARCHAR(32) NULL;
END
GO

-- Sections
IF COL_LENGTH(N'dbo.SndApp_WorkspaceSection', N'ColorKey') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_WorkspaceSection ADD
    ColorKey VARCHAR(32) NULL;
END
GO
