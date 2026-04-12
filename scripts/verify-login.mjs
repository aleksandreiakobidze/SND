/**
 * Check DB connectivity, user row, and bcrypt password (same path as POST /api/auth/login).
 *
 *   $env:SEED_EMAIL="..."; $env:SEED_PASSWORD="..."; node scripts/verify-login.mjs
 */
import bcrypt from "bcryptjs";
import sql from "mssql";
import { loadEnvForScripts } from "./load-env-local.mjs";

loadEnvForScripts();

const email = (process.env.SEED_EMAIL || "").trim().toLowerCase();
const password = process.env.SEED_PASSWORD;

if (!email || !password) {
  console.error("Set SEED_EMAIL and SEED_PASSWORD.");
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
  console.log(`Connecting to ${config.server} / ${config.database} as ${config.user} …`);
  const pool = await sql.connect(config);
  try {
    const res = await pool
      .request()
      .input("email", sql.NVarChar(320), email)
      .query(
        `SELECT CAST(Id AS VARCHAR(36)) AS Id, Email, PasswordHash, IsActive
         FROM dbo.SndApp_User
         WHERE LOWER(LTRIM(RTRIM(Email))) = @email`,
      );
    const row = res.recordset[0];
    if (!row) {
      console.log("RESULT: no user row for this email (wrong database or user not seeded).");
      process.exit(2);
    }
    console.log(`Found user Id=${row.Id}, IsActive=${row.IsActive}`);
    const hash = String(row.PasswordHash ?? "").trim();
    const ok = await bcrypt.compare(password, hash);
    console.log(`bcrypt.compare: ${ok ? "OK" : "FAIL (wrong password or hash)"}`);
    process.exit(ok ? 0 : 3);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  const msg = e?.message ?? String(e);
  if (msg.includes("Invalid object name") && msg.includes("SndApp_User")) {
    console.error(
      "Auth tables are missing. Run scripts/migrations/003-snd-app-auth.sql on this database (same MSSQL_* as .env.local), then seed:user.",
    );
  } else {
    console.error(e);
  }
  process.exit(1);
});
