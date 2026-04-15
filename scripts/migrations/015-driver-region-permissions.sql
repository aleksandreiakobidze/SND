/*
 * Migration 015 — Driver-region permissions table.
 * Stores which regions (Reg values from RealViewAgent) each driver is
 * permitted to serve during auto-distribution.
 *
 * Rule: a driver with ZERO rows here is treated as unrestricted
 * (can serve any region) for backward compatibility.
 */

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'SndApp_DriverRegion' AND TABLE_SCHEMA = 'dbo'
)
BEGIN
  CREATE TABLE dbo.SndApp_DriverRegion (
    Id         INT IDENTITY(1,1) NOT NULL,
    DriverId   INT               NOT NULL,
    RegionCode NVARCHAR(100)     NOT NULL,
    CONSTRAINT PK_DriverRegion   PRIMARY KEY (Id),
    CONSTRAINT UQ_DriverRegion   UNIQUE (DriverId, RegionCode)
  );

  CREATE INDEX IX_DriverRegion_Driver ON dbo.SndApp_DriverRegion (DriverId);

  PRINT 'Migration 015: dbo.SndApp_DriverRegion created.';
END
ELSE
BEGIN
  PRINT 'Migration 015: dbo.SndApp_DriverRegion already exists — skipped.';
END
GO
