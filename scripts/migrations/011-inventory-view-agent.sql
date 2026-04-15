/*
 * Migration 011 — InventoryViewAgent
 *
 * Creates a view for the Inventory Agent to query stock levels and movements.
 * Adjust the source table/view names to match your ERP schema.
 *
 * Prerequisites:
 *   - Stock/inventory tables must exist (e.g. dbo.StockSnapshot + dbo.StockMovement)
 *   - Product and Warehouse lookup tables
 *
 * This is a TEMPLATE — adapt column names and JOINs to your actual ERP tables.
 */

-- Uncomment and adapt when stock tables are available:
/*
IF OBJECT_ID('dbo.InventoryViewAgent', 'V') IS NOT NULL
  DROP VIEW dbo.InventoryViewAgent;
GO

CREATE VIEW dbo.InventoryViewAgent AS
SELECT
  -- Warehouse
  w.IdSac,
  w.Sac,
  w.SacAddress,

  -- Product
  p.IdProd,
  p.Prod,
  p.ProdCode,
  p.ProdT,
  p.ProdS,

  -- Stock Levels (from latest snapshot or calculated from movements)
  s.StockQty,
  s.StockLiters,
  s.StockValue,
  s.SafetyStockQty,

  -- Movement (NULL when row represents a snapshot, populated for movement records)
  m.MovementType,   -- 'IN', 'OUT', 'TRANSFER', 'WRITEOFF'
  m.MovementQty,
  m.MovementLiters,
  m.MovementValue,
  m.Data,

  -- Time helpers
  MONTH(ISNULL(m.Data, GETDATE())) AS Tve,
  YEAR(ISNULL(m.Data, GETDATE()))  AS Celi

FROM dbo.StockSnapshot     s
JOIN dbo.Product            p ON p.IdProd = s.IdProd
JOIN dbo.Warehouse          w ON w.IdSac  = s.IdSac
LEFT JOIN dbo.StockMovement m ON m.IdProd = s.IdProd AND m.IdSac = s.IdSac;
GO
*/

PRINT 'Migration 011: InventoryViewAgent template created (uncomment and adapt when stock tables exist)';
