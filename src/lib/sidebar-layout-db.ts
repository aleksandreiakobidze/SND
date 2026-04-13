import sql from "mssql";
import { getPool } from "@/lib/db";
import { type SidebarLayout, validateSidebarLayout } from "@/lib/sidebar-layout";

/** Idempotent: same DDL as scripts/migrations/007-snd-app-sidebar-layout.sql (dev-friendly if migration not run yet). */
async function ensureSidebarLayoutTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SndApp_SidebarLayout', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SndApp_SidebarLayout (
        Id TINYINT NOT NULL CONSTRAINT PK_SndApp_SidebarLayout PRIMARY KEY CONSTRAINT CK_SndApp_SidebarLayout_Id CHECK (Id = 1),
        LayoutJson NVARCHAR(MAX) NOT NULL,
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_SidebarLayout_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedByUserId UNIQUEIDENTIFIER NULL,
        CONSTRAINT FK_SndApp_SidebarLayout_User FOREIGN KEY (UpdatedByUserId) REFERENCES dbo.SndApp_User (Id) ON DELETE SET NULL
      );
    END
  `);
}

export async function getSidebarLayoutFromDb(): Promise<SidebarLayout | null> {
  const pool = await getPool();
  await ensureSidebarLayoutTable(pool);
  const res = await pool.request().query<{ LayoutJson: string | null }>(
    `SELECT TOP (1) LayoutJson FROM dbo.SndApp_SidebarLayout WHERE Id = 1`,
  );
  const row = res.recordset[0];
  if (!row?.LayoutJson) return null;
  try {
    const parsed = JSON.parse(row.LayoutJson) as unknown;
    return validateSidebarLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function upsertSidebarLayout(layout: SidebarLayout, updatedByUserId: string): Promise<void> {
  if (!validateSidebarLayout(layout)) {
    throw new Error("Invalid sidebar layout");
  }
  const pool = await getPool();
  await ensureSidebarLayoutTable(pool);
  const json = JSON.stringify(layout);
  const req = pool.request();
  req.input("json", sql.NVarChar(sql.MAX), json);
  req.input("uid", sql.UniqueIdentifier, updatedByUserId);
  await req.query(
    `IF EXISTS (SELECT 1 FROM dbo.SndApp_SidebarLayout WHERE Id = 1)
       UPDATE dbo.SndApp_SidebarLayout
       SET LayoutJson = @json, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @uid
       WHERE Id = 1;
     ELSE
       INSERT INTO dbo.SndApp_SidebarLayout (Id, LayoutJson, UpdatedAt, UpdatedByUserId)
       VALUES (1, @json, SYSUTCDATETIME(), @uid);`,
  );
}
