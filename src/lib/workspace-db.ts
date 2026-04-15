import { randomUUID } from "crypto";
import sql from "mssql";
import { getPool } from "@/lib/db";
import { chartTypeFromJsonString, parseTagsJson, serializeTagsJson } from "@/lib/chart-config-meta";

/** SQL Server 207: invalid column name — e.g. migrations not applied on dbo.SndApp_SavedReport. */
function isRecoverableSchemaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const any = e as { number?: number; originalError?: { number?: number } };
  if (any.number === 207 || any.originalError?.number === 207) return true;
  return /invalid column name/i.test(e.message);
}

export type SavedReportSource = "agent" | "builtin";

export type WorkspaceTree = {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  iconKey: string | null;
  isPinned: boolean;
  accentColor: string | null;
  sections: SectionTree[];
};

export type SectionTree = {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  colorKey: string | null;
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
  isFavorite: boolean;
  isPinned: boolean;
  lastOpenedAt: string | null;
  openCount: number;
  tags: string[];
  chartType: string | null;
};

/** Full report row for GET /api/reports/:id (SQL + chart JSON); not every list meta field is required. */
export type SavedReportFull = {
  id: string;
  title: string;
  source: SavedReportSource;
  narrative: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  prompt: string | null;
  sqlText: string | null;
  chartConfigJson: string | null;
};

function rowDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

/** True when DB is missing migration 009 (or similar) extended columns. */
function isMissingColumnSchemaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid column name|was not found|does not exist/i.test(msg)) return true;
  const n = (e as { number?: number })?.number;
  if (n === 207) return true;
  const orig = (e as { originalError?: { number?: number; message?: string } })?.originalError;
  if (orig?.number === 207) return true;
  if (orig?.message && /invalid column name/i.test(orig.message)) return true;
  return false;
}

/**
 * Legacy tree load (pre–migration 009): only columns from 001 + 006.
 * Used when BI metadata columns are not present yet.
 */
async function listWorkspaceTreeLegacy(ownerId: string): Promise<WorkspaceTree[]> {
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
      iconKey: null,
      isPinned: false,
      accentColor: null,
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
      colorKey: null,
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
      isFavorite: false,
      isPinned: false,
      lastOpenedAt: null,
      openCount: 0,
      tags: [],
      chartType: null,
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

async function listWorkspaceTreeWithBiColumns(ownerId: string): Promise<WorkspaceTree[]> {
  const pool = await getPool();
  const wReq = pool.request();
  wReq.input("ownerId", sql.UniqueIdentifier, ownerId);
  const wRes = await wReq.query<{
    Id: string;
    Title: string;
    SortOrder: number;
    CreatedAt: Date;
    UpdatedAt: Date;
    IconKey: string | null;
    IsPinned: boolean | null;
    AccentColor: string | null;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id, Title, SortOrder, CreatedAt, UpdatedAt,
            IconKey, IsPinned, AccentColor
     FROM dbo.SndApp_Workspace
     WHERE UserId = @ownerId
     ORDER BY IsPinned DESC, SortOrder ASC, CreatedAt ASC`,
  );

  const workspaces: WorkspaceTree[] = [];
  for (const row of wRes.recordset) {
    workspaces.push({
      id: row.Id,
      title: row.Title,
      sortOrder: row.SortOrder,
      createdAt: rowDate(row.CreatedAt),
      updatedAt: rowDate(row.UpdatedAt),
      iconKey: row.IconKey ?? null,
      isPinned: Boolean(row.IsPinned),
      accentColor: row.AccentColor ?? null,
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
    ColorKey: string | null;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id,
            CAST(WorkspaceId AS VARCHAR(36)) AS WorkspaceId,
            Title, SortOrder, CreatedAt, UpdatedAt, ColorKey
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
      colorKey: row.ColorKey ?? null,
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
    IsFavorite: boolean | null;
    IsPinned: boolean | null;
    LastOpenedAt: Date | null;
    OpenCount: number | null;
    TagsJson: string | null;
    ChartType: string | null;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id,
            CAST(SectionId AS VARCHAR(36)) AS SectionId,
            Title, Source, Narrative, SortOrder, CreatedAt, UpdatedAt,
            IsFavorite, IsPinned, LastOpenedAt, OpenCount, TagsJson, ChartType
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
      isFavorite: Boolean(row.IsFavorite),
      isPinned: Boolean(row.IsPinned),
      lastOpenedAt: row.LastOpenedAt ? rowDate(row.LastOpenedAt) : null,
      openCount: row.OpenCount ?? 0,
      tags: parseTagsJson(row.TagsJson),
      chartType: row.ChartType ?? null,
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

export async function listWorkspaceTree(ownerId: string): Promise<WorkspaceTree[]> {
  try {
    return await listWorkspaceTreeWithBiColumns(ownerId);
  } catch (e) {
    if (isMissingColumnSchemaError(e)) {
      console.warn(
        "[workspace-db] BI metadata columns missing; using legacy list query. Apply scripts/migrations/009-workspace-bi-metadata.sql for favorites, pins, chart type, etc.",
      );
      return listWorkspaceTreeLegacy(ownerId);
    }
    throw e;
  }
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
  return patchWorkspace(ownerId, workspaceId, { title });
}

export async function patchWorkspace(
  ownerId: string,
  workspaceId: string,
  patch: {
    title?: string;
    iconKey?: string | null;
    isPinned?: boolean;
    accentColor?: string | null;
  },
): Promise<boolean> {
  const hasTitle = typeof patch.title === "string" && patch.title.trim().length > 0;
  const hasIcon = patch.iconKey !== undefined;
  const hasPin = typeof patch.isPinned === "boolean";
  const hasAccent = patch.accentColor !== undefined;
  if (!hasTitle && !hasIcon && !hasPin && !hasAccent) return false;

  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, workspaceId);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  if (hasTitle) req.input("title", sql.NVarChar(500), patch.title!.trim().slice(0, 500));
  if (hasIcon) req.input("iconKey", sql.NVarChar(64), patch.iconKey);
  if (hasPin) req.input("isPinned", sql.Bit, patch.isPinned ? 1 : 0);
  if (hasAccent) req.input("accentColor", sql.NVarChar(32), patch.accentColor);

  const sets: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
  if (hasTitle) sets.push("Title = @title");
  if (hasIcon) sets.push("IconKey = @iconKey");
  if (hasPin) sets.push("IsPinned = @isPinned");
  if (hasAccent) sets.push("AccentColor = @accentColor");

  const res = await req.query(
    `UPDATE dbo.SndApp_Workspace SET ${sets.join(", ")}
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

/** Result of patching a workspace section (see migration 009 for ColorKey). */
export type PatchWorkspaceSectionOutcome =
  | { kind: "ok" }
  | { kind: "ok_title_only" }
  | { kind: "not_found" }
  | { kind: "color_requires_migration" };

export async function updateSection(
  ownerId: string,
  sectionId: string,
  title: string,
): Promise<boolean> {
  const r = await patchWorkspaceSection(ownerId, sectionId, { title });
  return r.kind === "ok" || r.kind === "ok_title_only";
}

export async function patchWorkspaceSection(
  ownerId: string,
  sectionId: string,
  patch: { title?: string; colorKey?: string | null },
): Promise<PatchWorkspaceSectionOutcome> {
  const hasTitle = typeof patch.title === "string" && patch.title.trim().length > 0;
  const hasColor = patch.colorKey !== undefined;
  if (!hasTitle && !hasColor) return { kind: "not_found" };

  const runUpdate = async (includeColor: boolean) => {
    const pool = await getPool();
    const req = pool.request();
    req.input("sid", sql.UniqueIdentifier, sectionId);
    req.input("oid", sql.UniqueIdentifier, ownerId);
    if (hasTitle) req.input("title", sql.NVarChar(500), patch.title!.trim().slice(0, 500));
    if (includeColor && hasColor) req.input("colorKey", sql.NVarChar(32), patch.colorKey);

    const sets: string[] = ["sec.UpdatedAt = SYSUTCDATETIME()"];
    if (hasTitle) sets.push("sec.Title = @title");
    if (includeColor && hasColor) sets.push("sec.ColorKey = @colorKey");

    const res = await req.query(
      `UPDATE sec SET ${sets.join(", ")}
     FROM dbo.SndApp_WorkspaceSection sec
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE sec.Id = @sid AND w.UserId = @oid`,
    );
    return (res.rowsAffected?.[0] ?? 0) > 0;
  };

  try {
    const ok = await runUpdate(true);
    if (!ok) return { kind: "not_found" };
    return { kind: "ok" };
  } catch (e) {
    if (!isRecoverableSchemaError(e)) throw e;
    if (hasTitle && hasColor) {
      try {
        const ok = await runUpdate(false);
        if (!ok) return { kind: "not_found" };
        return { kind: "ok_title_only" };
      } catch (e2) {
        throw e2;
      }
    }
    if (hasColor && !hasTitle) {
      return { kind: "color_requires_migration" };
    }
    throw e;
  }
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
    chartType?: string | null;
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
  const ct =
    typeof payload.chartType === "string" && payload.chartType.trim()
      ? payload.chartType.trim().slice(0, 32)
      : null;

  const runInsert = async (includeSortOrder: boolean, includeChartType: boolean) => {
    const req = pool.request();
    req.input("id", sql.UniqueIdentifier, id);
    req.input("sectionId", sql.UniqueIdentifier, sectionId);
    req.input("title", sql.NVarChar(500), payload.title.trim().slice(0, 500));
    req.input("source", sql.VarChar(20), payload.source);
    req.input("prompt", NVARCHAR_MAX, payload.prompt ?? null);
    req.input("sqlText", NVARCHAR_MAX, payload.sqlText ?? null);
    req.input("chartJson", NVARCHAR_MAX, payload.chartConfigJson ?? null);
    req.input("narrative", NVARCHAR_MAX, payload.narrative ?? null);
    req.input("chartType", sql.VarChar(32), ct);

    let insertSql: string;
    /** Literal 0 avoids subquery edge cases; user can reorder via workspace UI. */
    if (includeSortOrder && includeChartType) {
      insertSql = `INSERT INTO dbo.SndApp_SavedReport
       (Id, SectionId, Title, Source, Prompt, SqlText, ChartConfigJson, Narrative, SortOrder, ChartType)
     VALUES (@id, @sectionId, @title, @source, @prompt, @sqlText, @chartJson, @narrative, 0, @chartType)`;
    } else if (includeSortOrder) {
      insertSql = `INSERT INTO dbo.SndApp_SavedReport
       (Id, SectionId, Title, Source, Prompt, SqlText, ChartConfigJson, Narrative, SortOrder)
     VALUES (@id, @sectionId, @title, @source, @prompt, @sqlText, @chartJson, @narrative, 0)`;
    } else {
      insertSql = `INSERT INTO dbo.SndApp_SavedReport
       (Id, SectionId, Title, Source, Prompt, SqlText, ChartConfigJson, Narrative)
     VALUES (@id, @sectionId, @title, @source, @prompt, @sqlText, @chartJson, @narrative)`;
    }
    await req.query(insertSql);
  };

  /** Try full → no ChartType → base columns. Driver error shapes vary; do not rely only on error 207. */
  const variants: Array<[boolean, boolean]> = [
    [true, true],
    [true, false],
    [false, false],
  ];
  let lastErr: unknown;
  for (const [includeSortOrder, includeChartType] of variants) {
    try {
      await runInsert(includeSortOrder, includeChartType);
      return { id };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function fetchSavedReportFull(
  ownerId: string,
  reportId: string,
  includeSortOrderColumn: boolean,
): Promise<SavedReportFull | null> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.UniqueIdentifier, reportId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  const sortExpr = includeSortOrderColumn ? "r.SortOrder" : "CAST(0 AS INT)";
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
            ${sortExpr} AS SortOrder, r.CreatedAt, r.UpdatedAt
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

export async function getSavedReportFull(
  ownerId: string,
  reportId: string,
): Promise<SavedReportFull | null> {
  try {
    return await fetchSavedReportFull(ownerId, reportId, true);
  } catch (e) {
    if (!isRecoverableSchemaError(e)) throw e;
    return fetchSavedReportFull(ownerId, reportId, false);
  }
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

export type SavedReportPatch = {
  title?: string;
  sectionId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  tags?: string[] | null;
};

/** Title and/or section move run in one transaction; favorites/pins/tags use a follow-up update. */
export async function patchSavedReport(
  ownerId: string,
  reportId: string,
  patch: SavedReportPatch,
): Promise<boolean> {
  const titleTrim = typeof patch.title === "string" ? patch.title.trim() : "";
  const hasTitle = titleTrim.length > 0;
  const targetSid =
    typeof patch.sectionId === "string" && patch.sectionId.trim() !== ""
      ? patch.sectionId.trim()
      : null;
  const hasMove = Boolean(targetSid);
  const hasFav = typeof patch.isFavorite === "boolean";
  const hasPin = typeof patch.isPinned === "boolean";
  const hasTags = patch.tags !== undefined;

  if (!hasTitle && !hasMove && !hasFav && !hasPin && !hasTags) return false;

  // Metadata-only patch (no title/section change)
  if (!hasTitle && !hasMove) {
    const pool = await getPool();
    const req = pool.request();
    req.input("rid", sql.UniqueIdentifier, reportId);
    req.input("oid", sql.UniqueIdentifier, ownerId);
    if (hasFav) req.input("isFavorite", sql.Bit, patch.isFavorite ? 1 : 0);
    if (hasPin) req.input("isPinned", sql.Bit, patch.isPinned ? 1 : 0);
    if (hasTags) {
      const tj = serializeTagsJson(patch.tags ?? []);
      req.input("tagsJson", NVARCHAR_MAX, tj);
    }
    const sets: string[] = ["r.UpdatedAt = SYSUTCDATETIME()"];
    if (hasFav) sets.push("r.IsFavorite = @isFavorite");
    if (hasPin) sets.push("r.IsPinned = @isPinned");
    if (hasTags) sets.push("r.TagsJson = @tagsJson");
    const res = await req.query(
      `UPDATE r SET ${sets.join(", ")}
       FROM dbo.SndApp_SavedReport r
       INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
       INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
       WHERE r.Id = @rid AND w.UserId = @oid`,
    );
    return (res.rowsAffected?.[0] ?? 0) > 0;
  }

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

    if (hasFav || hasPin || hasTags) {
      const ok = await patchSavedReport(ownerId, reportId, {
        ...(hasFav ? { isFavorite: patch.isFavorite } : {}),
        ...(hasPin ? { isPinned: patch.isPinned } : {}),
        ...(hasTags ? { tags: patch.tags } : {}),
      });
      return ok;
    }

    return true;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

const RECORD_OPEN_FULL = `UPDATE r SET r.LastOpenedAt = SYSUTCDATETIME(), r.OpenCount = r.OpenCount + 1, r.UpdatedAt = SYSUTCDATETIME()
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`;

const RECORD_OPEN_MINIMAL = `UPDATE r SET r.UpdatedAt = SYSUTCDATETIME()
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`;

export async function recordReportOpened(ownerId: string, reportId: string): Promise<boolean> {
  const pool = await getPool();
  const run = async (sqlText: string) => {
    const req = pool.request();
    req.input("rid", sql.UniqueIdentifier, reportId);
    req.input("oid", sql.UniqueIdentifier, ownerId);
    const res = await req.query(sqlText);
    return (res.rowsAffected?.[0] ?? 0) > 0;
  };
  try {
    return await run(RECORD_OPEN_FULL);
  } catch (e) {
    if (!isRecoverableSchemaError(e)) throw e;
    return run(RECORD_OPEN_MINIMAL);
  }
}

export async function updateSavedReportChartType(
  ownerId: string,
  reportId: string,
  chartType: string | null,
): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.UniqueIdentifier, reportId);
  req.input("oid", sql.UniqueIdentifier, ownerId);
  const ct =
    typeof chartType === "string" && chartType.trim().length > 0
      ? chartType.trim().slice(0, 32)
      : null;
  req.input("chartType", sql.VarChar(32), ct);
  const res = await req.query(
    `UPDATE r SET r.ChartType = @chartType, r.UpdatedAt = SYSUTCDATETIME()
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

export async function duplicateSavedReport(
  ownerId: string,
  reportId: string,
  targetSectionId?: string,
): Promise<{ id: string } | null> {
  const full = await getSavedReportFull(ownerId, reportId);
  if (!full) return null;

  const pool = await getPool();
  const sidReq = pool.request();
  sidReq.input("rid", sql.UniqueIdentifier, reportId);
  sidReq.input("oid", sql.UniqueIdentifier, ownerId);
  const sidRes = await sidReq.query<{ SectionId: string }>(
    `SELECT CAST(r.SectionId AS VARCHAR(36)) AS SectionId
     FROM dbo.SndApp_SavedReport r
     INNER JOIN dbo.SndApp_WorkspaceSection sec ON sec.Id = r.SectionId
     INNER JOIN dbo.SndApp_Workspace w ON w.Id = sec.WorkspaceId
     WHERE r.Id = @rid AND w.UserId = @oid`,
  );
  const currentSectionId = sidRes.recordset[0]?.SectionId;
  if (!currentSectionId) return null;

  const sectionId = targetSectionId?.trim() || currentSectionId;
  if (sectionId !== currentSectionId) {
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
  }

  const chartType = chartTypeFromJsonString(full.chartConfigJson);

  const copyTitle = `${full.title} (copy)`.trim().slice(0, 500);
  return createSavedReport(ownerId, sectionId, {
    title: copyTitle.length > 0 ? copyTitle : "Copy",
    source: full.source,
    prompt: full.prompt,
    sqlText: full.sqlText,
    chartConfigJson: full.chartConfigJson,
    narrative: full.narrative,
    chartType,
  });
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
