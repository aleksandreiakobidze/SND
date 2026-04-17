/*
 * Migration 016 — Product pallet units (IdProd -> units per pallet) and vehicle MaxPallets.
 * Populate SndApp_ProductPalletCapacity yourself (IdProd must match RealViewAgent IdProd as string).
 */

IF OBJECT_ID(N'dbo.SndApp_ProductPalletCapacity', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SndApp_ProductPalletCapacity (
    IdProd NVARCHAR(50) NOT NULL,
    UnitsPerPallet NUMERIC(12, 2) NOT NULL,
    CONSTRAINT PK_SndApp_ProductPalletCapacity PRIMARY KEY (IdProd),
    CONSTRAINT CK_SndApp_ProductPalletCapacity_Units CHECK (UnitsPerPallet > 0)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SndApp_DriverTable' AND COLUMN_NAME = 'MaxPallets'
)
BEGIN
  ALTER TABLE dbo.SndApp_DriverTable ADD MaxPallets INT NULL;
END
GO

PRINT 'Migration 016: SndApp_ProductPalletCapacity + SndApp_DriverTable.MaxPallets.';
