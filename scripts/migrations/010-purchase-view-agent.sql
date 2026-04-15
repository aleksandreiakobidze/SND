/*
 * Migration 010 — PurchaseViewAgent
 *
 * Creates a view for the Purchase Agent to query procurement data.
 * Adjust the source table/view names to match your ERP schema.
 *
 * Prerequisites:
 *   - A purchase/procurement table must exist (e.g. dbo.PurchaseHeader + dbo.PurchaseLine)
 *   - Product, Supplier, and Warehouse lookup tables
 *
 * This is a TEMPLATE — adapt column names and JOINs to your actual ERP tables.
 */

-- Uncomment and adapt when the source procurement tables are available:
/*
IF OBJECT_ID('dbo.PurchaseViewAgent', 'V') IS NOT NULL
  DROP VIEW dbo.PurchaseViewAgent;
GO

CREATE VIEW dbo.PurchaseViewAgent AS
SELECT
  -- Purchase Header
  ph.IdPurchase1,
  ph.Data,
  ph.Zedd,
  ph.Shen,

  -- Purchase Line
  pl.IdPurchase2,
  pl.Raod,
  pl.Fasi,
  pl.Tanxa,
  pl.TevadobaTotal,

  -- Supplier
  s.IdSupplier,
  s.Supplier,
  s.SupplierCode,
  s.SupplierType,

  -- Product
  p.IdProd,
  p.Prod,
  p.ProdCode,
  p.ProdT,
  p.ProdS,

  -- Warehouse
  w.IdSac,
  w.Sac,

  -- Time helpers
  MONTH(ph.Data) AS Tve,
  YEAR(ph.Data)  AS Celi

FROM dbo.PurchaseHeader ph
JOIN dbo.PurchaseLine   pl ON pl.IdPurchase1 = ph.IdPurchase1
JOIN dbo.Supplier       s  ON s.IdSupplier   = ph.IdSupplier
JOIN dbo.Product        p  ON p.IdProd       = pl.IdProd
LEFT JOIN dbo.Warehouse w  ON w.IdSac        = ph.IdSac;
GO
*/

PRINT 'Migration 010: PurchaseViewAgent template created (uncomment and adapt when procurement tables exist)';
