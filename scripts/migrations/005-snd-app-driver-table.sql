-- Driver lookup for UI + RealViewAgent IdMdz/Mdz assignment.
-- Matches ERP-style table: IdMdz (key) + Mdz (name). App defaults: MSSQL_DRIVER_COL_ID=IdMdz, MSSQL_DRIVER_COL_NAME=Mdz.
-- Legacy installs used Id + DisplayName + IsActive — set env: MSSQL_DRIVER_COL_ID=Id, MSSQL_DRIVER_COL_NAME=DisplayName, MSSQL_DRIVER_ACTIVE_COL=IsActive

IF OBJECT_ID(N'dbo.SndApp_DriverTable', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_DriverTable (
    IdMdz INT NOT NULL CONSTRAINT PK_SndApp_DriverTable PRIMARY KEY,
    Mdz NVARCHAR(200) NOT NULL
  );
END
GO
