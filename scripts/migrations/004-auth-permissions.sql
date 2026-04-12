-- Permissions + RolePermission. Run after 003.
-- Maps existing roles to capabilities (admin UI, agent, workspace, dashboard, online orders).

IF OBJECT_ID(N'dbo.SndApp_Permission', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_Permission (
    Id INT NOT NULL IDENTITY(1, 1) CONSTRAINT PK_SndApp_Permission PRIMARY KEY,
    [Key] NVARCHAR(64) NOT NULL,
    CONSTRAINT UQ_SndApp_Permission_Key UNIQUE ([Key])
  );
END
GO

-- Seed permission keys (idempotent)
IF NOT EXISTS (SELECT 1 FROM dbo.SndApp_Permission WHERE [Key] = N'view_dashboard')
  INSERT INTO dbo.SndApp_Permission ([Key]) VALUES (N'view_dashboard');
IF NOT EXISTS (SELECT 1 FROM dbo.SndApp_Permission WHERE [Key] = N'use_agent')
  INSERT INTO dbo.SndApp_Permission ([Key]) VALUES (N'use_agent');
IF NOT EXISTS (SELECT 1 FROM dbo.SndApp_Permission WHERE [Key] = N'edit_workspace')
  INSERT INTO dbo.SndApp_Permission ([Key]) VALUES (N'edit_workspace');
IF NOT EXISTS (SELECT 1 FROM dbo.SndApp_Permission WHERE [Key] = N'access_online_orders')
  INSERT INTO dbo.SndApp_Permission ([Key]) VALUES (N'access_online_orders');
IF NOT EXISTS (SELECT 1 FROM dbo.SndApp_Permission WHERE [Key] = N'manage_users')
  INSERT INTO dbo.SndApp_Permission ([Key]) VALUES (N'manage_users');
GO

IF OBJECT_ID(N'dbo.SndApp_RolePermission', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_RolePermission (
    RoleId INT NOT NULL,
    PermissionId INT NOT NULL,
    CONSTRAINT PK_SndApp_RolePermission PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_SndApp_RolePermission_Role FOREIGN KEY (RoleId) REFERENCES dbo.SndApp_Role (Id) ON DELETE CASCADE,
    CONSTRAINT FK_SndApp_RolePermission_Permission FOREIGN KEY (PermissionId) REFERENCES dbo.SndApp_Permission (Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_SndApp_RolePermission_Role ON dbo.SndApp_RolePermission (RoleId);
  CREATE INDEX IX_SndApp_RolePermission_Permission ON dbo.SndApp_RolePermission (PermissionId);
END
GO

-- Link roles to permissions (skip if already linked)
-- admin: all
INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.SndApp_Role r
INNER JOIN dbo.SndApp_Permission p ON 1 = 1
WHERE r.Name = N'admin'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.SndApp_RolePermission rp
    WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );

-- analyst: view_dashboard, use_agent, edit_workspace, access_online_orders
INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.SndApp_Role r
INNER JOIN dbo.SndApp_Permission p ON p.[Key] IN (
  N'view_dashboard', N'use_agent', N'edit_workspace', N'access_online_orders'
)
WHERE r.Name = N'analyst'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.SndApp_RolePermission rp
    WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );

-- viewer: view_dashboard
INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.SndApp_Role r
INNER JOIN dbo.SndApp_Permission p ON p.[Key] = N'view_dashboard'
WHERE r.Name = N'viewer'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.SndApp_RolePermission rp
    WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );

-- operator: view_dashboard, access_online_orders
INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.SndApp_Role r
INNER JOIN dbo.SndApp_Permission p ON p.[Key] IN (N'view_dashboard', N'access_online_orders')
WHERE r.Name = N'operator'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.SndApp_RolePermission rp
    WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );
GO
