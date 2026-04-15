/*
 * Suggested indexes for RealViewAgent workload (SQL Server)
 * =========================================================
 * RealViewAgent is a VIEW — you cannot CREATE INDEX ON a view unless it is
 * a schema-bound indexed view. Apply these indexes to the UNDERLYING table(s)
 * that the view reads from (line / detail table is typical).
 *
 * HOW TO FIND TABLES:
 *   SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.RealViewAgent'));
 *   -- Or: sp_helptext 'dbo.RealViewAgent'
 *
 * Replace every occurrence of:
 *   [REPLACE_WITH_LINE_TABLE]   → your main line-level table (same grain as one row per IdReal2)
 *
 * Column names below match SND defaults (IdReal1, Data, Reg, ...).
 * If your physical names differ, rename columns in the script before running.
 *
 * Run in a maintenance window; test on a copy first. Drop conflicting old indexes if needed.
 */

-- ---------------------------------------------------------------------------
-- 1) Date range scans (dashboard, reports, filters) — highest priority
-- ---------------------------------------------------------------------------
/*
CREATE NONCLUSTERED INDEX IX_RVA_Line_Data
ON [dbo].[REPLACE_WITH_LINE_TABLE] ([Data] ASC)
INCLUDE ([IdReal1], [Tanxa], [Reg], [ProdS], [Manag], [IdOrg], [IdProd]);
*/

-- ---------------------------------------------------------------------------
-- 2) Order header grouping / joins (IdReal1 appears in GROUP BY everywhere)
-- ---------------------------------------------------------------------------
/*
CREATE NONCLUSTERED INDEX IX_RVA_Line_IdReal1
ON [dbo].[REPLACE_WITH_LINE_TABLE] ([IdReal1] ASC)
INCLUDE ([Data], [Tanxa], [Lon], [Lat], [IdMdz], [Micodeba]);
*/

-- ---------------------------------------------------------------------------
-- 3) Sales map / geo: rows with coordinates (partial filter if SQL Server edition allows)
--    SQL Server 2008+ supports filtered indexes:
-- ---------------------------------------------------------------------------
/*
CREATE NONCLUSTERED INDEX IX_RVA_Line_Geo_NotNull
ON [dbo].[REPLACE_WITH_LINE_TABLE] ([Lon], [Lat])
INCLUDE ([IdReal1], [Data], [Tanxa], [IdMdz], [Micodeba])
WHERE [Lon] IS NOT NULL AND [Lat] IS NOT NULL;
*/

-- ---------------------------------------------------------------------------
-- 4) Common dimension filters (pick the ones you filter most often)
-- ---------------------------------------------------------------------------
/*
CREATE NONCLUSTERED INDEX IX_RVA_Line_Reg_Data
ON [dbo].[REPLACE_WITH_LINE_TABLE] ([Reg] ASC, [Data] ASC)
INCLUDE ([IdReal1], [Tanxa]);
*/

/*
CREATE NONCLUSTERED INDEX IX_RVA_Line_IdProd_Data
ON [dbo].[REPLACE_WITH_LINE_TABLE] ([IdProd] ASC, [Data] ASC)
INCLUDE ([Tanxa], [TevadobaTotal]);
*/

-- ---------------------------------------------------------------------------
-- 5) Statistics: keep auto-stats on; after bulk loads run:
-- ---------------------------------------------------------------------------
/*
UPDATE STATISTICS [dbo].[REPLACE_WITH_LINE_TABLE] WITH FULLSCAN;
*/
