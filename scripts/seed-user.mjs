/**
 * Create an app user in dbo.SndApp_User + role assignments (dbo.SndApp_UserRole).
 *
 * Usage (PowerShell):
 *   $env:SEED_EMAIL="user@example.com"; $env:SEED_PASSWORD="your-password"; node scripts/seed-user.mjs
 *
 * Roles (comma-separated, default: analyst only — does NOT grant admin / manage_users):
 *   $env:SEED_ROLES="analyst"
 * Full test bootstrap like the old script:
 *   $env:SEED_ROLES="admin,analyst,viewer,operator"
 *
 * If the user already exists:
 *   SEED_RESET_PASSWORD=1 — update password hash (needs SEED_PASSWORD)
 *   SEED_UPDATE_ROLES=1 — replace role assignments with SEED_ROLES (no password required)
 *
 * Uses the same MSSQL_* env vars as the app (see src/lib/db.ts).
 * Loads `.env` / `.env.local` so the DB matches `next dev` (see scripts/load-env-local.mjs).
 */
import bcrypt from "bcryptjs";
import sql from "mssql";
import { randomUUID } from "node:crypto";
import { loadEnvForScripts } from "./load-env-local.mjs";

loadEnvForScripts();

const ROUNDS = 12;

function parseRoles() {
  const raw = process.env.SEED_ROLES;
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return ["analyst"];
}

const ROLES = parseRoles();

const email = (process.env.SEED_EMAIL || "").trim().toLowerCase();
const password = process.env.SEED_PASSWORD;
const displayName = process.env.SEED_DISPLAY_NAME?.trim() || null;
const resetPassword = process.env.SEED_RESET_PASSWORD === "1" || process.env.SEED_RESET_PASSWORD === "true";
const updateRoles = process.env.SEED_UPDATE_ROLES === "1" || process.env.SEED_UPDATE_ROLES === "true";

if (!email) {
  console.error("Set SEED_EMAIL (non-empty).");
  process.exit(1);
}
if (!password && !updateRoles) {
  console.error("Set SEED_PASSWORD, or use SEED_UPDATE_ROLES=1 to change roles without a password.");
  process.exit(1);
}
if (resetPassword && !password) {
  console.error("SEED_RESET_PASSWORD=1 requires SEED_PASSWORD.");
  process.exit(1);
}

const config = {
  server: process.env.MSSQL_SERVER || "192.168.0.200",
  database: process.env.MSSQL_DATABASE || "SND",
  user: process.env.MSSQL_USER || "SND",
  password: process.env.MSSQL_PASSWORD || "Sandro1991!",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

async function main() {
  console.log(`Using DB ${config.server} / ${config.database} (user ${config.user})`);
  const pool = await sql.connect(config);
  try {
    const existing = await pool
      .request()
      .input("email", sql.NVarChar(320), email)
      .query(
        `SELECT CAST(Id AS VARCHAR(36)) AS Id FROM dbo.SndApp_User WHERE LOWER(LTRIM(RTRIM(Email))) = @email`,
      );

    if (existing.recordset.length > 0) {
      const userId = existing.recordset[0].Id;
      if (!resetPassword && !updateRoles) {
        console.error(
          `User already exists: ${email}. Set SEED_RESET_PASSWORD=1 to update password, or SEED_UPDATE_ROLES=1 to replace roles (use SEED_ROLES).`,
        );
        process.exit(1);
      }
      if (resetPassword) {
        const hash = await bcrypt.hash(password, ROUNDS);
        await pool
          .request()
          .input("email", sql.NVarChar(320), email)
          .input("hash", sql.NVarChar(255), hash)
          .query(
            `UPDATE dbo.SndApp_User SET PasswordHash = @hash, UpdatedAt = SYSUTCDATETIME() WHERE LOWER(LTRIM(RTRIM(Email))) = @email`,
          );
        console.log(`Updated password for ${email}`);
      }
      if (updateRoles) {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
          const del = new sql.Request(transaction);
          del.input("uid", sql.UniqueIdentifier, userId);
          await del.query(`DELETE FROM dbo.SndApp_UserRole WHERE UserId = @uid`);
          for (const rn of ROLES) {
            const r = new sql.Request(transaction);
            r.input("uid", sql.UniqueIdentifier, userId);
            r.input("rname", sql.NVarChar(50), rn);
            const ins = await r.query(
              `INSERT INTO dbo.SndApp_UserRole (UserId, RoleId)
               SELECT @uid, Id FROM dbo.SndApp_Role WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@rname)))`,
            );
            if (ins.rowsAffected[0] === 0) {
              throw new Error(`Role not found in dbo.SndApp_Role: "${rn}"`);
            }
          }
          await transaction.commit();
          console.log(`Updated roles for ${email}: ${ROLES.join(", ")}`);
        } catch (e) {
          await transaction.rollback();
          throw e;
        }
      }
      return;
    }

    if (!password) {
      console.error("New user requires SEED_PASSWORD.");
      process.exit(1);
    }
    const hash = await bcrypt.hash(password, ROUNDS);
    const userId = randomUUID();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const ins = new sql.Request(transaction);
      ins.input("id", sql.UniqueIdentifier, userId);
      ins.input("email", sql.NVarChar(320), email);
      ins.input("hash", sql.NVarChar(255), hash);
      ins.input("name", sql.NVarChar(200), displayName);
      await ins.query(
        `INSERT INTO dbo.SndApp_User (Id, Email, PasswordHash, DisplayName)
         VALUES (@id, @email, @hash, @name)`,
      );

      for (const rn of ROLES) {
        const r = new sql.Request(transaction);
        r.input("uid", sql.UniqueIdentifier, userId);
        r.input("rname", sql.NVarChar(50), rn);
        await r.query(
          `INSERT INTO dbo.SndApp_UserRole (UserId, RoleId)
           SELECT @uid, Id FROM dbo.SndApp_Role WHERE Name = @rname`,
        );
      }

      await transaction.commit();
      console.log(`Created user ${email} (${userId}) with roles: ${ROLES.join(", ")}`);
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  const msg = e?.message ?? String(e);
  if (msg.includes("Invalid object name") && msg.includes("SndApp_User")) {
    console.error(`
Run auth migration on this database first (SSMS: open scripts/migrations/003-snd-app-auth.sql, select DB "${process.env.MSSQL_DATABASE || "SND"}", Execute).
If the app uses workspaces, run 001 and 002 before or after as needed, then seed:user again.
`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
