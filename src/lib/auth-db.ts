import { createHash, randomBytes, randomUUID } from "crypto";
import sql from "mssql";
import { getPool } from "@/lib/db";
import {
  legacyPermissionsFromRoleNames,
  PERMISSION_MANAGE_USERS,
} from "@/lib/auth-permissions";

export type AuthUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string;
  isActive: boolean;
};

export async function countUsers(): Promise<number> {
  const pool = await getPool();
  const res = await pool.request().query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM dbo.SndApp_User`,
  );
  return res.recordset[0]?.c ?? 0;
}

export async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  const pool = await getPool();
  const req = pool.request();
  const normalized = email.trim().toLowerCase();
  req.input("email", sql.NVarChar(320), normalized);
  const res = await req.query<{
    Id: string;
    Email: string;
    DisplayName: string | null;
    PasswordHash: string;
    IsActive: boolean;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id, Email, DisplayName, PasswordHash, IsActive
     FROM dbo.SndApp_User
     WHERE LOWER(LTRIM(RTRIM(Email))) = @email`,
  );
  const row = res.recordset[0];
  if (!row) return null;
  return {
    id: row.Id,
    email: row.Email,
    displayName: row.DisplayName,
    passwordHash: String(row.PasswordHash ?? "").trim(),
    isActive: row.IsActive,
  };
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const pool = await getPool();
  const req = pool.request();
  req.input("uid", sql.UniqueIdentifier, userId);
  const res = await req.query<{ Name: string }>(
    `SELECT r.Name
     FROM dbo.SndApp_UserRole ur
     INNER JOIN dbo.SndApp_Role r ON r.Id = ur.RoleId
     WHERE ur.UserId = @uid`,
  );
  return res.recordset.map((r) => r.Name);
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const roles = await getUserRoles(userId);
  try {
    const pool = await getPool();
    const req = pool.request();
    req.input("uid", sql.UniqueIdentifier, userId);
    const res = await req.query<{ Key: string }>(
      `SELECT DISTINCT p.[Key]
       FROM dbo.SndApp_UserRole ur
       INNER JOIN dbo.SndApp_RolePermission rp ON rp.RoleId = ur.RoleId
       INNER JOIN dbo.SndApp_Permission p ON p.Id = rp.PermissionId
       WHERE ur.UserId = @uid`,
    );
    const keys = res.recordset.map((r) => r.Key);
    if (keys.length > 0) return keys;
  } catch {
    /* SndApp_Permission not migrated */
  }
  return legacyPermissionsFromRoleNames(roles);
}

export type AuthUserPublic = {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  roles: string[];
};

export async function listUsers(): Promise<AuthUserPublic[]> {
  const pool = await getPool();
  const res = await pool.request().query<{
    Id: string;
    Email: string;
    DisplayName: string | null;
    IsActive: boolean;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id, Email, DisplayName, IsActive
     FROM dbo.SndApp_User
     ORDER BY Email`,
  );
  const rows = res.recordset;
  const out: AuthUserPublic[] = [];
  for (const row of rows) {
    const id = row.Id;
    const roles = await getUserRoles(id);
    out.push({
      id,
      email: row.Email,
      displayName: row.DisplayName,
      isActive: row.IsActive,
      roles,
    });
  }
  return out;
}

export async function findUserById(userId: string): Promise<AuthUserRow | null> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, userId);
  const res = await req.query<{
    Id: string;
    Email: string;
    DisplayName: string | null;
    PasswordHash: string;
    IsActive: boolean;
  }>(
    `SELECT CAST(Id AS VARCHAR(36)) AS Id, Email, DisplayName, PasswordHash, IsActive
     FROM dbo.SndApp_User WHERE Id = @id`,
  );
  const row = res.recordset[0];
  if (!row) return null;
  return {
    id: row.Id,
    email: row.Email,
    displayName: row.DisplayName,
    passwordHash: String(row.PasswordHash ?? "").trim(),
    isActive: row.IsActive,
  };
}

export async function setUserRoles(userId: string, roleNames: string[]): Promise<void> {
  const uniqueRoles = [...new Set(roleNames.map((r) => r.trim()).filter(Boolean))];
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const del = new sql.Request(transaction);
    del.input("uid", sql.UniqueIdentifier, userId);
    await del.query(`DELETE FROM dbo.SndApp_UserRole WHERE UserId = @uid`);

    for (const rn of uniqueRoles) {
      const r = new sql.Request(transaction);
      r.input("uid", sql.UniqueIdentifier, userId);
      r.input("rname", sql.NVarChar(50), rn.trim());
      await r.query(
        `INSERT INTO dbo.SndApp_UserRole (UserId, RoleId)
         SELECT @uid, Id FROM dbo.SndApp_Role WHERE Name = @rname`,
      );
    }
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function updateUserProfile(
  userId: string,
  fields: { displayName?: string | null; isActive?: boolean },
): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, userId);
  if (fields.displayName !== undefined) {
    req.input("name", sql.NVarChar(200), fields.displayName?.trim().slice(0, 200) || null);
  }
  if (fields.isActive !== undefined) {
    req.input("active", sql.Bit, fields.isActive ? 1 : 0);
  }
  const sets: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
  if (fields.displayName !== undefined) sets.push("DisplayName = @name");
  if (fields.isActive !== undefined) sets.push("IsActive = @active");
  await req.query(
    `UPDATE dbo.SndApp_User SET ${sets.join(", ")} WHERE Id = @id`,
  );
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, userId);
  req.input("hash", sql.NVarChar(255), passwordHash);
  await req.query(
    `UPDATE dbo.SndApp_User SET PasswordHash = @hash, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`,
  );
}

export async function countUsersWithRoleName(roleName: string): Promise<number> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rname", sql.NVarChar(50), roleName);
  const res = await req.query<{ c: number }>(
    `SELECT COUNT(DISTINCT ur.UserId) AS c
     FROM dbo.SndApp_UserRole ur
     INNER JOIN dbo.SndApp_Role r ON r.Id = ur.RoleId
     INNER JOIN dbo.SndApp_User u ON u.Id = ur.UserId AND u.IsActive = 1
     WHERE r.Name = @rname`,
  );
  return res.recordset[0]?.c ?? 0;
}

/** Active users who have this permission via any role (404 migration → admin role count for manage_users). */
export async function countUsersWithPermission(permissionKey: string): Promise<number> {
  try {
    const pool = await getPool();
    const req = pool.request();
    req.input("k", sql.NVarChar(64), permissionKey);
    const res = await req.query<{ c: number }>(
      `SELECT COUNT(DISTINCT u.Id) AS c
       FROM dbo.SndApp_User u
       INNER JOIN dbo.SndApp_UserRole ur ON ur.UserId = u.Id
       INNER JOIN dbo.SndApp_RolePermission rp ON rp.RoleId = ur.RoleId
       INNER JOIN dbo.SndApp_Permission p ON p.Id = rp.PermissionId AND p.[Key] = @k
       WHERE u.IsActive = 1`,
    );
    return res.recordset[0]?.c ?? 0;
  } catch {
    if (permissionKey === PERMISSION_MANAGE_USERS) {
      return countUsersWithRoleName("admin");
    }
    return 0;
  }
}

export type RoleWithPermissions = {
  id: number;
  name: string;
  permissionKeys: string[];
};

export async function getPermissionsUnionForRoleNames(roleNames: string[]): Promise<string[]> {
  const uniq = [...new Set(roleNames.map((r) => r.trim()).filter(Boolean))];
  if (uniq.length === 0) return [];
  const all = await listRolesWithPermissions();
  const set = new Set<string>();
  for (const nm of uniq) {
    const role = all.find((r) => r.name.toLowerCase() === nm.toLowerCase());
    if (role) role.permissionKeys.forEach((k) => set.add(k));
  }
  if (set.size === 0) return legacyPermissionsFromRoleNames(uniq);
  return [...set];
}

export async function listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const pool = await getPool();
  const rolesRes = await pool.request().query<{ Id: number; Name: string }>(
    `SELECT Id, Name FROM dbo.SndApp_Role ORDER BY Name`,
  );
  const roles = rolesRes.recordset;
  const out: RoleWithPermissions[] = [];
  for (const r of roles) {
    let keys: string[] = [];
    try {
      const req = pool.request();
      req.input("rid", sql.Int, r.Id);
      const pr = await req.query<{ Key: string }>(
        `SELECT p.[Key]
         FROM dbo.SndApp_RolePermission rp
         INNER JOIN dbo.SndApp_Permission p ON p.Id = rp.PermissionId
         WHERE rp.RoleId = @rid`,
      );
      keys = pr.recordset.map((x) => x.Key);
    } catch {
      keys = legacyPermissionsFromRoleNames([r.Name]);
    }
    out.push({ id: r.Id, name: r.Name, permissionKeys: keys });
  }
  return out;
}

export async function countRoleUsers(roleId: number): Promise<number> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.Int, roleId);
  const res = await req.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM dbo.SndApp_UserRole WHERE RoleId = @rid`,
  );
  return res.recordset[0]?.c ?? 0;
}

export async function createRole(name: string): Promise<number> {
  const pool = await getPool();
  const req = pool.request();
  const trimmed = name.trim().slice(0, 50);
  req.input("name", sql.NVarChar(50), trimmed);
  const res = await req.query<{ Id: number }>(
    `INSERT INTO dbo.SndApp_Role (Name) OUTPUT INSERTED.Id AS Id VALUES (@name)`,
  );
  const id = res.recordset[0]?.Id;
  if (id === undefined) throw new Error("Failed to create role");
  return id;
}

export async function updateRoleName(roleId: number, name: string): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.Int, roleId);
  req.input("name", sql.NVarChar(50), name.trim().slice(0, 50));
  await req.query(`UPDATE dbo.SndApp_Role SET Name = @name WHERE Id = @rid`);
}

export async function deleteRole(roleId: number): Promise<void> {
  const n = await countRoleUsers(roleId);
  if (n > 0) throw new Error("Role is assigned to users");
  const pool = await getPool();
  const req = pool.request();
  req.input("rid", sql.Int, roleId);
  await req.query(`DELETE FROM dbo.SndApp_Role WHERE Id = @rid`);
}

/**
 * Ensures every app permission key exists in dbo.SndApp_Permission.
 * INSERT ... SELECT inserts zero rows if the key is missing (no SQL error) — that made role saves look successful while dropping unchecked keys.
 */
async function assertPermissionRowsExist(
  pool: sql.ConnectionPool,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  const req = pool.request();
  const placeholders = keys.map((_, i) => `@k${i}`).join(", ");
  keys.forEach((k, i) => {
    req.input(`k${i}`, sql.NVarChar(64), k);
  });
  const r = await req.query<{ Key: string }>(
    `SELECT [Key] FROM dbo.SndApp_Permission WHERE [Key] IN (${placeholders})`,
  );
  const found = new Set(r.recordset.map((x) => x.Key));
  const missing = keys.filter((k) => !found.has(k));
  if (missing.length > 0) {
    throw new Error(
      `Permission row(s) missing in dbo.SndApp_Permission: ${missing.join(", ")}. ` +
        `Run the latest scripts in scripts/migrations/ (e.g. 006-assign-sales-driver-permission.sql) on this database.`,
    );
  }
}

export async function setRolePermissionKeys(roleId: number, permissionKeys: string[]): Promise<void> {
  const pool = await getPool();
  await assertPermissionRowsExist(pool, permissionKeys);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const del = new sql.Request(transaction);
    del.input("rid", sql.Int, roleId);
    await del.query(`DELETE FROM dbo.SndApp_RolePermission WHERE RoleId = @rid`);

    for (const pk of permissionKeys) {
      const ins = new sql.Request(transaction);
      ins.input("rid", sql.Int, roleId);
      ins.input("pkey", sql.NVarChar(64), pk);
      const result = await ins.query(
        `INSERT INTO dbo.SndApp_RolePermission (RoleId, PermissionId)
         SELECT @rid, Id FROM dbo.SndApp_Permission WHERE [Key] = @pkey`,
      );
      const affected = result.rowsAffected?.[0] ?? 0;
      if (affected !== 1) {
        throw new Error(
          `Failed to link permission "${pk}" to role (expected 1 row, got ${affected}). Check dbo.SndApp_Permission.`,
        );
      }
    }
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function createUserWithRoles(
  email: string,
  passwordHash: string,
  displayName: string | null,
  roleNames: string[],
): Promise<string> {
  const pool = await getPool();
  const userId = randomUUID();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ins = new sql.Request(transaction);
    ins.input("id", sql.UniqueIdentifier, userId);
    ins.input("email", sql.NVarChar(320), email.trim().toLowerCase());
    ins.input("hash", sql.NVarChar(255), passwordHash);
    ins.input("name", sql.NVarChar(200), displayName?.trim().slice(0, 200) || null);
    await ins.query(
      `INSERT INTO dbo.SndApp_User (Id, Email, PasswordHash, DisplayName)
       VALUES (@id, @email, @hash, @name)`,
    );

    for (const rn of roleNames) {
      const r = new sql.Request(transaction);
      r.input("uid", sql.UniqueIdentifier, userId);
      r.input("rname", sql.NVarChar(50), rn);
      await r.query(
        `INSERT INTO dbo.SndApp_UserRole (UserId, RoleId)
         SELECT @uid, Id FROM dbo.SndApp_Role WHERE Name = @rname`,
      );
    }

    await transaction.commit();
    return userId;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Opaque bearer token (hex). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function insertSession(userId: string, tokenHash: string, expiresAt: Date): Promise<string> {
  const pool = await getPool();
  const sessionId = randomUUID();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, sessionId);
  req.input("uid", sql.UniqueIdentifier, userId);
  req.input("th", sql.VarChar(64), tokenHash);
  req.input("exp", sql.DateTime2, expiresAt);
  await req.query(
    `INSERT INTO dbo.SndApp_Session (Id, UserId, TokenHash, ExpiresAt) VALUES (@id, @uid, @th, @exp)`,
  );
  return sessionId;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  req.input("id", sql.UniqueIdentifier, sessionId);
  await req.query(`DELETE FROM dbo.SndApp_Session WHERE Id = @id`);
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  const pool = await getPool();
  const req = pool.request();
  req.input("uid", sql.UniqueIdentifier, userId);
  await req.query(`DELETE FROM dbo.SndApp_Session WHERE UserId = @uid`);
}

export type SessionUser = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string | null;
};

export async function findValidSession(tokenHash: string): Promise<SessionUser | null> {
  const pool = await getPool();
  const req = pool.request();
  req.input("th", sql.VarChar(64), tokenHash);
  const res = await req.query<{
    SessionId: string;
    UserId: string;
    Email: string;
    DisplayName: string | null;
  }>(
    `SELECT CAST(s.Id AS VARCHAR(36)) AS SessionId,
            CAST(u.Id AS VARCHAR(36)) AS UserId,
            u.Email, u.DisplayName
     FROM dbo.SndApp_Session s
     INNER JOIN dbo.SndApp_User u ON u.Id = s.UserId
     WHERE LTRIM(RTRIM(CAST(s.TokenHash AS VARCHAR(64)))) = @th
       AND s.ExpiresAt > SYSUTCDATETIME() AND u.IsActive = 1`,
  );
  const row = res.recordset[0];
  if (!row) return null;
  return {
    sessionId: row.SessionId,
    userId: row.UserId,
    email: row.Email,
    displayName: row.DisplayName,
  };
}
