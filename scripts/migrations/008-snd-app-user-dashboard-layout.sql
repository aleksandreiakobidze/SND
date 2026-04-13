-- Per-user dashboard widget order + chart preferences (home page).
IF OBJECT_ID(N'dbo.SndApp_UserDashboardLayout', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_UserDashboardLayout (
    UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_UserDashboardLayout PRIMARY KEY,
    LayoutJson NVARCHAR(MAX) NOT NULL,
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_UserDashboardLayout_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SndApp_UserDashboardLayout_User FOREIGN KEY (UserId) REFERENCES dbo.SndApp_User (Id) ON DELETE CASCADE
  );
END
GO
