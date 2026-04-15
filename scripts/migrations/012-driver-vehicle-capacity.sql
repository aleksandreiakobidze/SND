/*
 * Migration 012 — Driver vehicle capacity columns.
 * Adds load capacity and vehicle info to SndApp_DriverTable
 * for the auto-distribution engine.
 */

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'SndApp_DriverTable' AND TABLE_SCHEMA = 'dbo'
    AND COLUMN_NAME = 'MaxCapacityLiters'
)
BEGIN
  ALTER TABLE dbo.SndApp_DriverTable ADD MaxCapacityLiters NUMERIC(12,2) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'SndApp_DriverTable' AND TABLE_SCHEMA = 'dbo'
    AND COLUMN_NAME = 'MaxCapacityKg'
)
BEGIN
  ALTER TABLE dbo.SndApp_DriverTable ADD MaxCapacityKg NUMERIC(12,2) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'SndApp_DriverTable' AND TABLE_SCHEMA = 'dbo'
    AND COLUMN_NAME = 'MaxOrders'
)
BEGIN
  ALTER TABLE dbo.SndApp_DriverTable ADD MaxOrders INT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'SndApp_DriverTable' AND TABLE_SCHEMA = 'dbo'
    AND COLUMN_NAME = 'VehiclePlate'
)
BEGIN
  ALTER TABLE dbo.SndApp_DriverTable ADD VehiclePlate NVARCHAR(20) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'SndApp_DriverTable' AND TABLE_SCHEMA = 'dbo'
    AND COLUMN_NAME = 'VehicleType'
)
BEGIN
  ALTER TABLE dbo.SndApp_DriverTable ADD VehicleType NVARCHAR(50) NULL;
END
GO

PRINT 'Migration 012: Driver vehicle capacity columns added to SndApp_DriverTable.';
