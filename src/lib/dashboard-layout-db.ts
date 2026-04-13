import sql from "mssql";
import { getPool } from "@/lib/db";
import { type DashboardLayout, validateDashboardLayout } from "@/lib/dashboard-layout";

async function ensureDashboardLayoutTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SndApp_UserDashboardLayout', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SndApp_UserDashboardLayout (
        UserId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SndApp_UserDashboardLayout PRIMARY KEY,
        LayoutJson NVARCHAR(MAX) NOT NULL,
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SndApp_UserDashboardLayout_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_SndApp_UserDashboardLayout_User FOREIGN KEY (UserId) REFERENCES dbo.SndApp_User (Id) ON DELETE CASCADE
      );
    END
  `);
}

export async function getDashboardLayoutForUser(userId: string): Promise<DashboardLayout | null> {
  const pool = await getPool();
  await ensureDashboardLayoutTable(pool);
  const req = pool.request();
  req.input("uid", sql.UniqueIdentifier, userId);
  const res = await req.query<{ LayoutJson: string | null }>(
    `SELECT LayoutJson FROM dbo.SndApp_UserDashboardLayout WHERE UserId = @uid`,
  );
  const row = res.recordset[0];
  if (!row?.LayoutJson) return null;
  try {
    const parsed = JSON.parse(row.LayoutJson) as unknown;
    return validateDashboardLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function upsertDashboardLayout(userId: string, layout: DashboardLayout): Promise<void> {
  if (!validateDashboardLayout(layout)) {
    throw new Error("Invalid dashboard layout");
  }
  const pool = await getPool();
  await ensureDashboardLayoutTable(pool);
  const json = JSON.stringify(layout);
  const req = pool.request();
  req.input("json", sql.NVarChar(sql.MAX), json);
  req.input("uid", sql.UniqueIdentifier, userId);
  await req.query(
    `IF EXISTS (SELECT 1 FROM dbo.SndApp_UserDashboardLayout WHERE UserId = @uid)
       UPDATE dbo.SndApp_UserDashboardLayout
       SET LayoutJson = @json, UpdatedAt = SYSUTCDATETIME()
       WHERE UserId = @uid;
     ELSE
       INSERT INTO dbo.SndApp_UserDashboardLayout (UserId, LayoutJson, UpdatedAt)
       VALUES (@uid, @json, SYSUTCDATETIME());`,
  );
}
