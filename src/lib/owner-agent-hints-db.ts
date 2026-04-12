import { randomUUID } from "crypto";
import sql from "mssql";
import { getPool } from "@/lib/db";

export const MAX_OWNER_AGENT_HINTS = 50;
export const MAX_OWNER_AGENT_HINT_BODY_CHARS = 8000;
/** Upper bound for the combined block appended to the system prompt. */
export const MAX_OWNER_HINTS_PROMPT_CHARS = 16000;

export type OwnerAgentHint = {
  id: string;
  title: string | null;
  body: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

function rowDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

const NVARCHAR_MAX = sql.NVarChar(sql.MAX);

export async function countOwnerAgentHints(ownerId: string): Promise<number> {
  const pool = await getPool();
  const req = pool.request();
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  const res = await req.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM dbo.SndApp_OwnerAgentHint WHERE UserId = @ownerId`,
  );
  return res.recordset[0]?.c ?? 0;
}

export async function listOwnerAgentHints(ownerId: string): Promise<OwnerAgentHint[]> {
  const pool = await getPool();
  const req = pool.request();
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  const res = await req.query<{
    Id: string;
    Title: string | null;
    Body: string;
    SortOrder: number;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id, Title, Body, SortOrder, CreatedAt, UpdatedAt
     FROM dbo.SndApp_OwnerAgentHint
     WHERE UserId = @ownerId
     ORDER BY SortOrder ASC, CreatedAt ASC`,
  );
  return res.recordset.map((row) => ({
    id: row.Id,
    title: row.Title,
    body: row.Body,
    sortOrder: row.SortOrder,
    createdAt: rowDate(row.CreatedAt),
    updatedAt: rowDate(row.UpdatedAt),
  }));
}

export type CreateOwnerAgentHintInput = {
  title: string | null;
  body: string;
};

export async function createOwnerAgentHint(
  ownerId: string,
  input: CreateOwnerAgentHintInput,
): Promise<{ id: string } | { error: "limit" | "empty" }> {
  const body = input.body.trim();
  if (!body) return { error: "empty" };
  if (body.length > MAX_OWNER_AGENT_HINT_BODY_CHARS) {
    throw new Error(`Body exceeds ${MAX_OWNER_AGENT_HINT_BODY_CHARS} characters`);
  }
  const n = await countOwnerAgentHints(ownerId);
  if (n >= MAX_OWNER_AGENT_HINTS) return { error: "limit" };

  const id = randomUUID();
  const title =
    input.title?.trim().slice(0, 200) || null;
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, id);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  req.input("title", sql.NVarChar(200), title);
  req.input("body", NVARCHAR_MAX, body);
  await req.query(
    `INSERT INTO dbo.SndApp_OwnerAgentHint (Id, UserId, Title, Body, SortOrder)
     VALUES (@id, @ownerId, @title, @body,
       (SELECT ISNULL(MAX(SortOrder), -1) + 1 FROM dbo.SndApp_OwnerAgentHint WHERE UserId = @ownerId))`,
  );
  return { id };
}

export async function updateOwnerAgentHint(
  ownerId: string,
  hintId: string,
  input: CreateOwnerAgentHintInput,
): Promise<boolean> {
  const body = input.body.trim();
  if (!body) return false;
  if (body.length > MAX_OWNER_AGENT_HINT_BODY_CHARS) {
    throw new Error(`Body exceeds ${MAX_OWNER_AGENT_HINT_BODY_CHARS} characters`);
  }
  const title = input.title?.trim().slice(0, 200) || null;
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, hintId);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  req.input("title", sql.NVarChar(200), title);
  req.input("body", NVARCHAR_MAX, body);
  const res = await req.query(
    `UPDATE dbo.SndApp_OwnerAgentHint
     SET Title = @title, Body = @body, UpdatedAt = SYSUTCDATETIME()
     WHERE Id = @id AND UserId = @ownerId`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

export async function deleteOwnerAgentHint(ownerId: string, hintId: string): Promise<boolean> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, hintId);
  req.input("ownerId", sql.UniqueIdentifier, ownerId);
  const res = await req.query(
    `DELETE FROM dbo.SndApp_OwnerAgentHint WHERE Id = @id AND UserId = @ownerId`,
  );
  return (res.rowsAffected?.[0] ?? 0) > 0;
}

/**
 * Builds the markdown block for the agent system prompt. Truncates by character budget
 * (keeps full bullets until the cap).
 */
export function formatOwnerHintsForSystemPrompt(hints: OwnerAgentHint[]): string {
  if (hints.length === 0) return "";

  const header =
    "## User-specific instructions (highest priority when interpreting this user's words)\n" +
    "Apply these notes when mapping informal terms to database columns, filters, or report meanings:\n\n";

  let body = "";
  for (const h of hints) {
    const titleLine = h.title?.trim() ? `**${h.title.trim()}**\n` : "";
    const bullet = `- ${titleLine}${h.body.trim().replace(/\n/g, "\n  ")}\n\n`;
    if (header.length + body.length + bullet.length > MAX_OWNER_HINTS_PROMPT_CHARS) break;
    body += bullet;
  }

  const out = header + body;
  if (out.length <= MAX_OWNER_HINTS_PROMPT_CHARS) return out.trimEnd();
  return out.slice(0, MAX_OWNER_HINTS_PROMPT_CHARS).trimEnd() + "\n\n[…truncated]";
}
