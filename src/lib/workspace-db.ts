import { randomUUID } from "crypto";
import sql from "mssql";
import { getPool } from "@/lib/db";

export type SavedReportSource = "agent" | "builtin";

export type WorkspaceTree = {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  sections: SectionTree[];
};

export type SectionTree = {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  reports: SavedReportMeta[];
};

export type SavedReportMeta = {
  id: string;
  title: string;
  source: SavedReportSource;
  narrative: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedReportFull = SavedReportMeta & {
  prompt: string | null;
  sqlText: string | null;
  chartConfigJson: string | null;
};

function rowDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

export async function listWorkspaceTree(ownerId: string): Promise<WorkspaceTree[]> {
  const pool = await getPool();
  const wReq = pool.request();
  wReq.input("ownerId", sql.UniqueIdentifier, ownerId);
  const wRes = await wReq.query<{
    Id: string;
    Title: string;
    SortOrder: number;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id, Title, SortOrder, CreatedAt, UpdatedAt
     FROM dbo.SndApp_Workspace
     WHERE UserId = @ownerId
     ORDER BY SortOrder ASC, CreatedAt ASC`,
  );

  const workspaces: WorkspaceTree[] = [];
  for (const row of wRes.recordset) {
    workspaces.push({
      id: row.Id,
      title: row.Title,
      sortOrder: row.SortOrder,
      createdAt: rowDate(row.CreatedAt),
      updatedAt: rowDate(row.UpdatedAt),
      sections: [],
    });
  }

  if (workspaces.length === 0) return [];

  const wsIds = workspaces.map((w) => w.id);
  const sReq = pool.request();
  wsIds.forEach((id, i) => sReq.input(`w${i}`, sql.UniqueIdentifier, id));
  const inList = wsIds.map((_, i) => `@w${i}`).join(", ");
  const sRes = await sReq.query<{
    Id: string;
    WorkspaceId: string;
    Title: string;
    SortOrder: number;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id,
            CAST(WorkspaceId AS VARCHAR(36)) AS WorkspaceId,
            Title, SortOrder, CreatedAt, UpdatedAt
     FROM dbo.SndApp_WorkspaceSection
     WHERE WorkspaceId IN (${inList})
     ORDER BY SortOrder ASC, CreatedAt ASC`,
  );

  const sectionByWs = new Map<string, SectionTree[]>();
  const allSections: SectionTree[] = [];
  for (const row of sRes.recordset) {
    const sec: SectionTree = {
      id: row.Id,
      title: row.Title,
      sortOrder: row.SortOrder,
      createdAt: rowDate(row.CreatedAt),
      updatedAt: rowDate(row.UpdatedAt),
      reports: [],
    };
    const list = sectionByWs.get(row.WorkspaceId) ?? [];
    list.push(sec);
    sectionByWs.set(row.WorkspaceId, list);
    allSections.push(sec);
  }

  for (const w of workspaces) {
    w.sections = sectionByWs.get(w.id) ?? [];
  }

  if (allSections.length === 0) return workspaces;

  const secIds = allSections.map((s) => s.id);
  const rReq = pool.request();
  secIds.forEach((id, i) => rReq.input(`s${i}`, sql.UniqueIdentifier, id));
  const rInList = secIds.map((_, i) => `@s${i}`).join(", ");
  const rRes = await rReq.query<{
    Id: string;
    SectionId: string;
    Title: string;
    Source: string;
    Narrative: string | null;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id,
            CAST(SectionId AS VARCHAR(36)) AS SectionId,
            Title, Source, Narrative, CreatedAt, UpdatedAt
     FROM dbo.SndApp_SavedReport
     WHERE SectionId IN (${rInList})
     ORDER BY CreatedAt ASC`,
  );

  const reportsBySection = new Map<string, SavedReportMeta[]>();
  for (const row of rRes.recordset) {
    const meta: SavedReportMeta = {
      id: row.Id,
      title: row.Title,
      source: row.Source === "builtin" ? "builtin" : "agent",
      narrative: row.Narrative,
      createdAt: rowDate(row.CreatedAt),
      updatedAt: rowDate(row.UpdatedAt),
    };
    const list = reportsBySection.get(row.SectionId) ?? [];
    list.push(meta);
    reportsBySection.set(row.SectionId, list);
  }

  for (const s of allSections) {
    s.reports = reportsBySection.get(s.id) ?? [];
  }

  return workspaces;
}

export async function createWorkspace(
  ownerId: string,
  title: string,
): Promise<{ id: string }> {
  const pool = await getPool();
  const id = randomUUID();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, id);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  req.input("title", sql.NVarChar(500), title.trim().slice(0, 500));
  await req.query(
    `INSERT INTO dbo.SndApp_Workspace (Id, UserId, Title, SortOrder)
     VALUES (@id, @ownerId, @title,
       (SELECT ISNULL(MAX(SortOrder), -1) + 1 FROM dbo.SndApp_Workspace WHERE UserId = @ownerId))`,
  );
  return { id };
}

export async function updateWorkspace(
  ownerId: string,
  workspaceId: string,
  title: string,
): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, workspaceId);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  req.input("title", sql.NVarChar(500), title.trim().slice(0, 500));
  const res = await req.query(
    `UPDATE dbo.SndApp_Workspace
     SET Title = @title, UpdatedAt = SYSUTCDATETIME()
     WHERE Id = @id AND UserId = @ownerId`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

export async function deleteWorkspace(ownerId: string, workspaceId: string): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, workspaceId);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  const res = await req.query(
    `DELETE FROM dbo.SndApp_Workspace WHERE Id = @id AND UserId = @ownerId`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

export async function createSection(
  ownerId: string,
  workspaceId: string,
  title: string,
): Promise<{ id: string } | null> {
  const pool = await getPool();
  const check = pool.request();
  check.input("wid", sql.UniqueIdentifier, workspaceId);
  check.input("oid", sql.UniqueIdentifier, ownerId);
  const ok = await check.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM dbo.SndApp_Workspace WHERE Id = @wid AND UserId = @oid`,
  );
  if (!ok.recordset[0] || ok.recordset[0].c === 0) return null;

  const id = randomUUID();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, id);
  req.input("workspaceId", sql.UniqueIdentifier, workspaceId);
  req.input("title", sql.NVarChar(500), title.trim().slice(0, 500));
  await req.query(
    `INSERT INTO dbo.SndApp_WorkspaceSection (Id, WorkspaceId, Title, SortOrder)
     VALUES (@id, @workspaceId, @title,
       (SELECT ISNULL(MAX(SortOrder), -1) + 1 FROM dbo.SndApp_WorkspaceSection WHERE WorkspaceId = @workspaceId))`,
  );
  return { id };
}

export async function updateSection(
  ownerId: string,
  sectionId: string,
  title: string,
): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("sid", sql.UniqueIdentifier, sectionId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  req.input("title", sql.NVarChar(500), title.trim().slice(0, 500));
  const res = await req.query(
    `UPDATE sec SET sec.Title = @title, sec.UpdatedAt = SYSUTCDATETIME()
     FROM dbo.SndApp_WorkspaceSection sec
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE sec.Id = @sid AND w.UserId = @oid`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

export async function deleteSection(ownerId: string, sectionId: string): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("sid", sql.UniqueIdentifier, sectionId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  const res = await req.query(
    `DELETE sec
     FROM dbo.SndApp_WorkspaceSection sec
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE sec.Id = @sid AND w.UserId = @oid`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

const NVARCHAR_MAX = sql.NVarChar(sql.MAX);

export async function createSavedReport(
  ownerId: string,
  sectionId: string,
  payload: {
    title: string;
    source: SavedReportSource;
    prompt: string | null;
    sqlText: string | null;
    chartConfigJson: string | null;
    narrative: string | null;
  },
): Promise<{ id: string } | null> {
  const pool = await getPool();
  const check = pool.request();
  check.input("sid", sql.UniqueIdentifier, sectionId);
  check.input("oid", sql.UniqueIdentifier, ownerId);
  const ok = await check.query<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM dbo.SndApp_WorkspaceSection sec
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE sec.Id = @sid AND w.UserId = @oid`,
  );
  if (!ok.recordset[0] || ok.recordset[0].c === 0) return null;

  const id = randomUUID();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, id);
  req.input("sectionId", sql.UniqueIdentifier, sectionId);
  req.input("title", sql.NVarChar(500), payload.title.trim().slice(0, 500));
  req.input("source", sql.VarChar(20), payload.source);
  req.input("prompt", NVARCHAR_MAX, payload.prompt ?? null);
  req.input("sqlText", NVARCHAR_MAX, payload.sqlText ?? null);
  req.input("chartJson", NVARCHAR_MAX, payload.chartConfigJson ?? null);
  req.input("narrative", NVARCHAR_MAX, payload.narrative ?? null);

  await req.query(
    `INSERT INTO dbo.SndApp_SavedReport
       (Id, SectionId, Title, Source, Prompt, SqlText, ChartConfigJson, Narrative)
     VALUES (@id, @sectionId, @title, @source, @prompt, @sqlText, @chartJson, @narrative)`,
  );
  return { id };
}

export async function getSavedReportFull(
  ownerId: string,
  reportId: string,
): Promise<SavedReportFull | null> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.UniqueIdentifier, reportId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  const res = await req.query<{
    Id: string;
    Title: string;
    Source: string;
    Prompt: string | null;
    SqlText: string | null;
    ChartConfigJson: string | null;
    Narrative: string | null;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(r.Id AS VARCHAR(36)) AS Id, r.Title, r.Source, r.Prompt, r.SqlText, r.ChartConfigJson, r.Narrative, r.CreatedAt, r.UpdatedAt
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`,
  );
  const row = res.recordset[0];
  if (!row) return null;
  return {
    id: row.Id,
    title: row.Title,
    source: row.Source === "builtin" ? "builtin" : "agent",
    prompt: row.Prompt,
    sqlText: row.SqlText,
    chartConfigJson: row.ChartConfigJson,
    narrative: row.Narrative,
    createdAt: rowDate(row.CreatedAt),
    updatedAt: rowDate(row.UpdatedAt),
  };
}

export async function updateSavedReportTitle(
  ownerId: string,
  reportId: string,
  title: string,
): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.UniqueIdentifier, reportId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  req.input("title", sql.NVarChar(500), title.trim().slice(0, 500));
  const res = await req.query(
    `UPDATE r SET r.Title = @title, r.UpdatedAt = SYSUTCDATETIME()
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

export async function deleteSavedReport(ownerId: string, reportId: string): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.UniqueIdentifier, reportId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  const res = await req.query(
    `DELETE r
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}
