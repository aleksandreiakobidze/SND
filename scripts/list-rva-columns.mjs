/**
 * List columns of dbo.RealViewAgent (SND / analytics DB) so you can set MSSQL_RVA_COL_* in .env.local.
 *
 *   npm run rva:columns
 */
import sql from "mssql";
import { loadEnvForScripts } from "./load-env-local.mjs";

loadEnvForScripts();

const config = {
  server: process.env.MSSQL_SERVER || "192.168.0.200",
  database: process.env.MSSQL_ANALYTICS_DATABASE?.trim() || process.env.MSSQL_DATABASE || "SND",
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
  console.log(`DB: ${config.server} / ${config.database}\n`);
  const pool = await sql.connect(config);
  try {
    const res = await pool.request().query(`
      SELECT c.name AS ColumnName, ty.name AS TypeName
      FROM sys.columns c
      INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      WHERE c.object_id = OBJECT_ID(N'dbo.RealViewAgent')
      ORDER BY c.column_id;
    `);
    const rows = res.recordset;
    if (!rows?.length) {
      console.error("No columns found. Is dbo.RealViewAgent a table/view in this database?");
      process.exit(2);
    }
    console.log("Columns on dbo.RealViewAgent:\n");
    for (const r of rows) {
      console.log(`  ${r.ColumnName}\t${r.TypeName}`);
    }
    console.log("\nFor dashboard KPIs (COUNT DISTINCT orders), usually:");
    const idReal = rows.find((r) => String(r.ColumnName) === "IdReal1");
    if (idReal) {
      console.log(`  MSSQL_RVA_COL_IDREAL1 — default IdReal1 matches your DB ✓`);
    } else {
      console.log("  MSSQL_RVA_COL_IDREAL1=<column> — pick the realization / order header id column");
      const hints = rows.filter((r) => /IdReal/i.test(String(r.ColumnName)));
      for (const h of hints) console.log(`  candidate: ${h.ColumnName}`);
    }
    console.log("\nSee src/lib/realview-columns.ts (RVA_DEFAULTS) for all overridable keys.");
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
