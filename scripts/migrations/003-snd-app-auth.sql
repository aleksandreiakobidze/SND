-- App users, roles, sessions + rename OwnerId -> UserId on workspace and agent hints.
-- Run after 001 and 002.

IF OBJECT_ID(N'dbo.SndApp_Role', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_Role (
    Id INT NOT NULL IDENTITY(1, 1) CONSTRAINT PK_SndApp_Role PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL,
    CONSTRAINT UQ_SndApp_Role_Name UNIQUE (Name)
  );
  INSERT INTO dbo.SndApp_Role (Name) VALUES (N'admin'), (N'analyst'), (N'viewer'), (N'operator');
END
GO

IF OBJECT_ID(N'dbo.SndApp_User', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_User (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_User PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Email NVARCHAR(320) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    DisplayName NVARCHAR(200) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_SndApp_User_IsActive DEFAULT (1),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_User_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_User_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SndApp_User_Email UNIQUE (Email)
  );
  CREATE INDEX IX_SndApp_User_Email ON dbo.SndApp_User (Email);
END
GO

IF OBJECT_ID(N'dbo.SndApp_UserRole', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_UserRole (
    UserId UNIQUEIDENTIFIER NOT NULL,
    RoleId INT NOT NULL,
    CONSTRAINT PK_SndApp_UserRole PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_SndApp_UserRole_User FOREIGN KEY (UserId) REFERENCES dbo.SndApp_User (Id) ON DELETE CASCADE,
    CONSTRAINT FK_SndApp_UserRole_Role FOREIGN KEY (RoleId) REFERENCES dbo.SndApp_Role (Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_SndApp_UserRole_User ON dbo.SndApp_UserRole (UserId);
END
GO

IF OBJECT_ID(N'dbo.SndApp_Session', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_Session (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_Session PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    TokenHash CHAR(64) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_Session_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SndApp_Session_User FOREIGN KEY (UserId) REFERENCES dbo.SndApp_User (Id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX UQ_SndApp_Session_TokenHash ON dbo.SndApp_Session (TokenHash);
  CREATE INDEX IX_SndApp_Session_User ON dbo.SndApp_Session (UserId);
  CREATE INDEX IX_SndApp_Session_Expires ON dbo.SndApp_Session (ExpiresAt);
END
GO

-- Workspace: drop old index, rename column, add new index (only if table exists)
IF OBJECT_ID(N'dbo.SndApp_Workspace', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SndApp_Workspace_Owner' AND object_id = OBJECT_ID(N'dbo.SndApp_Workspace'))
    DROP INDEX IX_SndApp_Workspace_Owner ON dbo.SndApp_Workspace;

  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'OwnerId' AND Object_ID = OBJECT_ID(N'dbo.SndApp_Workspace')
  )
    EXEC sp_rename N'dbo.SndApp_Workspace.OwnerId', N'UserId', N'COLUMN';

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SndApp_Workspace_User' AND object_id = OBJECT_ID(N'dbo.SndApp_Workspace'))
    CREATE INDEX IX_SndApp_Workspace_User ON dbo.SndApp_Workspace (UserId, SortOrder);
END
GO

-- Agent hints: same (only if table exists)
IF OBJECT_ID(N'dbo.SndApp_OwnerAgentHint', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SndApp_OwnerAgentHint_Owner' AND object_id = OBJECT_ID(N'dbo.SndApp_OwnerAgentHint'))
    DROP INDEX IX_SndApp_OwnerAgentHint_Owner ON dbo.SndApp_OwnerAgentHint;

  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'OwnerId' AND Object_ID = OBJECT_ID(N'dbo.SndApp_OwnerAgentHint')
  )
    EXEC sp_rename N'dbo.SndApp_OwnerAgentHint.OwnerId', N'UserId', N'COLUMN';

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SndApp_OwnerAgentHint_User' AND object_id = OBJECT_ID(N'dbo.SndApp_OwnerAgentHint'))
    CREATE INDEX IX_SndApp_OwnerAgentHint_User ON dbo.SndApp_OwnerAgentHint (UserId, SortOrder);
END
GO
