-- Persist display order for saved workspace reports (per section).
-- Run once with appropriate permissions.

IF COL_LENGTH(N'dbo.SndApp_SavedReport', N'SortOrder') IS NULL
BEGIN
  ALTER TABLE dbo.SndApp_SavedReport ADD
    SortOrder INT NOT NULL CONSTRAINT DF_SndApp_SavedReport_SortOrder DEFAULT (0);
END
GO

;WITH Ordered AS (
  SELECT
    Id,
    ROW_NUMBER() OVER (PARTITION BY SectionId ORDER BY CreatedAt ASC, Id ASC) - 1 AS NewOrder
  FROM dbo.SndApp_SavedReport
)
UPDATE r
SET r.SortOrder = o.NewOrder
FROM dbo.SndApp_SavedReport r
INNER JOIN Ordered o ON o.Id = r.Id;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SndApp_Report_Section_Sort'
    AND object_id = OBJECT_ID(N'dbo.SndApp_SavedReport')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_SndApp_Report_Section_Sort
    ON dbo.SndApp_SavedReport (SectionId, SortOrder);
END
GO
