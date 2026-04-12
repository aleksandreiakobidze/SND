-- Per-browser owner profile: free-form instructions injected into the SQL agent system prompt.
-- Same OwnerId as SndApp_Workspace (snd_workspace_owner cookie).

IF OBJECT_ID(N'dbo.SndApp_OwnerAgentHint', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_OwnerAgentHint (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_OwnerAgentHint PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(200) NULL,
    Body NVARCHAR(MAX) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_SndApp_OwnerAgentHint_SortOrder DEFAULT (0),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_OwnerAgentHint_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_OwnerAgentHint_UpdatedAt DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_SndApp_OwnerAgentHint_User ON dbo.SndApp_OwnerAgentHint (UserId, SortOrder);
END
GO
