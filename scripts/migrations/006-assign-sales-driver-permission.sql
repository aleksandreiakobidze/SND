-- Permission: assign_sales_driver (RealViewAgent IdMdz update from sales map). Run after 004.

IF NOT EXISTS (SELECT 1 FROM dbo.SndApp_Permission WHERE [Key] = N'assign_sales_driver')
  INSERT INTO dbo.SndApp_Permission ([Key]) VALUES (N'assign_sales_driver');
GO

-- admin: all permissions (already linked via 004 pattern — add new permission for admin)
INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.SndApp_Role r
INNER JOIN dbo.SndApp_Permission p ON p.[Key] = N'assign_sales_driver'
WHERE r.Name = N'admin'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.SndApp_RolePermission rp
    WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );
GO

-- analyst: sales map assign (same as dashboard access)
INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM dbo.SndApp_Role r
INNER JOIN dbo.SndApp_Permission p ON p.[Key] = N'assign_sales_driver'
WHERE r.Name = N'analyst'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.SndApp_RolePermission rp
    WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id
  );
GO
