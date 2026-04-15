/*
 * Migration 013 — Daily fleet schedule table.
 * Stores which drivers/vehicles are scheduled for each delivery date.
 * Used by the auto-distribution engine to restrict distribution
 * to only vehicles that are actually available on a given day.
 */

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'SndApp_FleetSchedule' AND TABLE_SCHEMA = 'dbo'
)
BEGIN
  CREATE TABLE dbo.SndApp_FleetSchedule (
    Id           INT IDENTITY(1,1) NOT NULL,
    DeliveryDate DATE              NOT NULL,
    DriverId     INT               NOT NULL,
    CreatedAt    DATETIME2         NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_FleetSchedule    PRIMARY KEY (Id),
    CONSTRAINT UQ_FleetSchedule    UNIQUE (DeliveryDate, DriverId)
  );

  CREATE INDEX IX_FleetSchedule_Date ON dbo.SndApp_FleetSchedule (DeliveryDate);

  PRINT 'Migration 013: dbo.SndApp_FleetSchedule created.';
END
ELSE
BEGIN
  PRINT 'Migration 013: dbo.SndApp_FleetSchedule already exists — skipped.';
END
GO
