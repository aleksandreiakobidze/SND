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
  sortOrder: number;
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
    SortOrder: number;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id,
            CAST(SectionId AS VARCHAR(36)) AS SectionId,
            Title, Source, Narrative, SortOrder, CreatedAt, UpdatedAt
     FROM dbo.SndApp_SavedReport
     WHERE SectionId IN (${rInList})
     ORDER BY SortOrder ASC, CreatedAt ASC`,
  );

  const reportsBySection = new Map<string, SavedReportMeta[]>();
  for (const row of rRes.recordset) {
    const meta: SavedReportMeta = {
      id: row.Id,
      title: row.Title,
      source: row.Source === "builtin" ? "builtin" : "agent",
      narrative: row.Narrative,
      sortOrder: row.SortOrder ?? 0,
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
       (Id, SectionId, Title, Source, Prompt, SqlText, ChartConfigJson, Narrative, SortOrder)
     VALUES (@id, @sectionId, @title, @source, @prompt, @sqlText, @chartJson, @narrative,
       (SELECT ISNULL(MAX(SortOrder), -1) + 1 FROM dbo.SndApp_SavedReport WHERE SectionId = @sectionId))`,
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
    SortOrder: number;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(r.Id AS VARCHAR(36)) AS Id, r.Title, r.Source, r.Prompt, r.SqlText, r.ChartConfigJson, r.Narrative,
            r.SortOrder, r.CreatedAt, r.UpdatedAt
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
    sortOrder: row.SortOrder ?? 0,
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

/** Optional title and/or target section; at least one must be provided. Runs in one transaction. */
export async function patchSavedReport(
  ownerId: string,
  reportId: string,
  patch: { title?: string; sectionId?: string },
): Promise<boolean> {
  const titleTrim = typeof patch.title === "string" ? patch.title.trim() : "";
  const hasTitle = titleTrim.length > 0;
  const targetSid =
    typeof patch.sectionId === "string" && patch.sectionId.trim() !== ""
      ? patch.sectionId.trim()
      : null;
  if (!hasTitle && !targetSid) return false;

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    if (targetSid) {
      const cur = await new sql.Request(transaction)
        .input("rid", sql.UniqueIdentifier, reportId)
        .input("oid", sql.UniqueIdentifier, ownerId)
        .query<{ SectionId: string }>(
          `SELECT CAST(r.SectionId AS VARCHAR(36)) AS SectionId
           FROM dbo.SndApp_SavedReport r
           INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
           INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
           WHERE r.Id = @rid AND w.UserId = @oid`,
        );
      const currentSid = cur.recordset[0]?.SectionId;
      if (!currentSid) {
        await transaction.rollback();
        return false;
      }
      if (currentSid.toLowerCase() !== targetSid.toLowerCase()) {
        const moveReq = new sql.Request(transaction);
        moveReq.input("rid", sql.UniqueIdentifier, reportId);
        moveReq.input("oid", sql.UniqueIdentifier, ownerId);
        moveReq.input("targetSid", sql.UniqueIdentifier, targetSid);
        const moved = await moveReq.query(
          `UPDATE r
           SET r.SectionId = tgt.Id,
               r.SortOrder = (
                 SELECT ISNULL(MAX(x.SortOrder), -1) + 1
                 FROM dbo.SndApp_SavedReport x
                 WHERE x.SectionId = tgt.Id AND x.Id <> r.Id
               ),
               r.UpdatedAt = SYSUTCDATETIME()
           FROM dbo.SndApp_SavedReport r
           INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
           INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId AND w.UserId = @oid
           INNER JOIN dbo.SndApp_WorkspaceSection tgt ON tgt.Id = @targetSid
           INNER JOIN dbo.SndApp_Workspace tw ON tw.Id = tgt.WorkspaceId AND tw.UserId = @oid
           WHERE r.Id = @rid`,
        );
        if ((moved.rowsAffected?.[0] ?? 0) === 0) {
          await transaction.rollback();
          return false;
        }
      }
    }

    if (hasTitle) {
      const titleReq = new sql.Request(transaction);
      titleReq.input("rid", sql.UniqueIdentifier, reportId);
      titleReq.input("oid", sql.UniqueIdentifier, ownerId);
      titleReq.input("title", sql.NVarChar(500), titleTrim.slice(0, 500));
      const upd = await titleReq.query(
        `UPDATE r SET r.Title = @title, r.UpdatedAt = SYSUTCDATETIME()
         FROM dbo.SndApp_SavedReport r
         INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
         INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
         WHERE r.Id = @rid AND w.UserId = @oid`,
      );
      if ((upd.rowsAffected?.[0] ?? 0) === 0) {
        await transaction.rollback();
        return false;
      }
    }

    await transaction.commit();
    return true;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function reorderSavedReports(
  ownerId: string,
  sectionId: string,
  orderedReportIds: string[],
): Promise<boolean> {
  if (orderedReportIds.length === 0) return true;
  const pool = await getPool();
  const check = await pool
    .request()
    .input("sid", sql.UniqueIdentifier, sectionId)
    .input("oid", sql.UniqueIdentifier, ownerId)
    .query<{ Id: string }>(
      `SELECT CAST(r.Id AS VARCHAR(36)) AS Id
       FROM dbo.SndApp_SavedReport r
       INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
       INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
       WHERE sec.Id = @sid AND w.UserId = @oid`,
    );
  const existing = new Set(check.recordset.map((r) => r.Id.toLowerCase()));
  if (existing.size !== orderedReportIds.length) return false;
  for (const id of orderedReportIds) {
    if (!existing.has(id.toLowerCase())) return false;
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (let i = 0; i < orderedReportIds.length; i++) {
      const req = new sql.Request(transaction);
      req.input("rid", sql.UniqueIdentifier, orderedReportIds[i]);
      req.input("oid", sql.UniqueIdentifier, ownerId);
      req.input("sid", sql.UniqueIdentifier, sectionId);
      req.input("so", sql.Int, i);
      await req.query(
        `UPDATE r SET r.SortOrder = @so, r.UpdatedAt = SYSUTCDATETIME()
         FROM dbo.SndApp_SavedReport r
         INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
         INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
         WHERE r.Id = @rid AND sec.Id = @sid AND w.UserId = @oid`,
      );
    }
    await transaction.commit();
    return true;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function reorderSections(
  ownerId: string,
  workspaceId: string,
  orderedSectionIds: string[],
): Promise<boolean> {
  if (orderedSectionIds.length === 0) return true;
  const pool = await getPool();
  const check = await pool
    .request()
    .input("wid", sql.UniqueIdentifier, workspaceId)
    .input("oid", sql.UniqueIdentifier, ownerId)
    .query<{ Id: string }>(
      `SELECT CAST(s.Id AS VARCHAR(36)) AS Id
       FROM dbo.SndApp_WorkspaceSection s
       INNER JOIN dbo.SndApp_Workspace w ON w.Id = s.WorkspaceId
       WHERE s.WorkspaceId = @wid AND w.UserId = @oid`,
    );
  const existing = new Set(check.recordset.map((r) => r.Id.toLowerCase()));
  if (existing.size !== orderedSectionIds.length) return false;
  for (const id of orderedSectionIds) {
    if (!existing.has(id.toLowerCase())) return false;
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (let i = 0; i < orderedSectionIds.length; i++) {
      const req = new sql.Request(transaction);
      req.input("sid", sql.UniqueIdentifier, orderedSectionIds[i]);
      req.input("oid", sql.UniqueIdentifier, ownerId);
      req.input("wid", sql.UniqueIdentifier, workspaceId);
      req.input("so", sql.Int, i);
      await req.query(
        `UPDATE sec SET sec.SortOrder = @so, sec.UpdatedAt = SYSUTCDATETIME()
         FROM dbo.SndApp_WorkspaceSection sec
         INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
         WHERE sec.Id = @sid AND sec.WorkspaceId = @wid AND w.UserId = @oid`,
      );
    }
    await transaction.commit();
    return true;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function reorderWorkspaces(ownerId: string, orderedWorkspaceIds: string[]): Promise<boolean> {
  if (orderedWorkspaceIds.length === 0) return true;
  const pool = await getPool();
  const check = await pool
    .request()
    .input("oid", sql.UniqueIdentifier, ownerId)
    .query<{ Id: string }>(
      `SELECT CAST(Id AS VARCHAR(36)) AS Id FROM dbo.SndApp_Workspace WHERE UserId = @oid`,
    );
  const existing = new Set(check.recordset.map((r) => r.Id.toLowerCase()));
  if (existing.size !== orderedWorkspaceIds.length) return false;
  for (const id of orderedWorkspaceIds) {
    if (!existing.has(id.toLowerCase())) return false;
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (let i = 0; i < orderedWorkspaceIds.length; i++) {
      const req = new sql.Request(transaction);
      req.input("id", sql.UniqueIdentifier, orderedWorkspaceIds[i]);
      req.input("oid", sql.UniqueIdentifier, ownerId);
      req.input("so", sql.Int, i);
      await req.query(
        `UPDATE dbo.SndApp_Workspace SET SortOrder = @so, UpdatedAt = SYSUTCDATETIME()
         WHERE Id = @id AND UserId = @oid`,
      );
    }
    await transaction.commit();
    return true;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}
