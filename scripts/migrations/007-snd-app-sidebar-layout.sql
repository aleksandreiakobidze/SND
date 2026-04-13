-- Global sidebar navigation layout (single row). Empty = clients use app defaults from nav-items.
IF OBJECT_ID(N'dbo.SndApp_SidebarLayout', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_SidebarLayout (
    Id TINYINT NOT NULL CONSTRAINT PK_SndApp_SidebarLayout PRIMARY KEY CONSTRAINT CK_SndApp_SidebarLayout_Id CHECK (Id = 1),
    LayoutJson NVARCHAR(MAX) NOT NULL,
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_SidebarLayout_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedByUserId UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_SndApp_SidebarLayout_User FOREIGN KEY (UpdatedByUserId) REFERENCES dbo.SndApp_User (Id) ON DELETE SET NULL
  );
END
GO
