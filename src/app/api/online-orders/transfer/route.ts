import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { executeStoredProcedure, getAnalyticsPool } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAccessOnlineOrders } from "@/lib/auth-roles";
import { sqlIdent } from "@/lib/online-columns";
import { getOnlineViewSqlName } from "@/lib/online-orders-sql";
import { resolveOnlineColumnMap } from "@/lib/online-schema-resolve";
import { validateMinOrderAmount } from "@/lib/online-transfer-rules";

const DEFAULT_SP = "dbo.usp_OnlineReal_Transfer";

function transferProcedureName(): string {
  const name = process.env.MSSQL_ONLINE_TRANSFER_SP || DEFAULT_SP;
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    throw new Error("Invalid MSSQL_ONLINE_TRANSFER_SP");
  }
  return name;
}

type TransferError = { idReal1: number; step: "validation" | "procedure"; message: string };

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canAccessOnlineOrders(auth.ctx.permissions)) return forbidden();

    const body = (await req.json()) as { idReal1List?: unknown };
    const raw = body.idReal1List;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Body must include idReal1List: number[] with at least one IdReal1." },
        { status: 400 }
      );
    }

    const idReal1List = [
      ...new Set(
        raw
          .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];

    if (idReal1List.length === 0) {
      return NextResponse.json({ error: "No valid IdReal1 values." }, { status: 400 });
    }

    const view = getOnlineViewSqlName();
    const cols = await resolveOnlineColumnMap();
    const pool = await getAnalyticsPool();
    const validationErrors: TransferError[] = [];
    const orderSnapshots: Array<{
      idReal1: number;
      orgT: string | null;
      orderTotal: number;
    }> = [];

    for (const idReal1 of idReal1List) {
      const r = await pool
        .request()
        .input("id", sql.Int, idReal1)
        .query<{ OrderTotal: number | null; OrgT: string | null }>(
          `SELECT CAST(SUM(${sqlIdent(cols.tanxa)}) AS float) AS OrderTotal,
                  MAX(${sqlIdent(cols.orgT)}) AS OrgT
           FROM ${view} WHERE ${sqlIdent(cols.idReal1)} = @id`
        );

      const row = r.recordset[0];
      if (!row || row.OrderTotal == null || Number(row.OrderTotal) === 0) {
        validationErrors.push({
          idReal1,
          step: "validation",
          message: `No lines found in ${view} for IdReal1=${idReal1}.`,
        });
        continue;
      }

      const orderTotal = Number(row.OrderTotal);
      const orgT = row.OrgT ?? null;
      orderSnapshots.push({ idReal1, orgT, orderTotal });

      const minCheck = validateMinOrderAmount(orgT, orderTotal);
      if (!minCheck.ok) {
        validationErrors.push({
          idReal1,
          step: "validation",
          message: minCheck.message ?? "Minimum order amount not met.",
        });
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          phase: "validation",
          errors: validationErrors,
          orderSnapshots,
          hint:
            "Fix amounts or segment (OrgT), or extend rules in online-transfer-rules.ts. Customer credit limits and other checks should be enforced in the SQL procedure as well.",
        },
        { status: 422 }
      );
    }

    const proc = transferProcedureName();
    const transferred: number[] = [];
    const procedureErrors: TransferError[] = [];

    for (const idReal1 of idReal1List) {
      try {
        await executeStoredProcedure(proc, [{ name: "IdReal1", type: sql.Int(), value: idReal1 }]);
        transferred.push(idReal1);
      } catch (e) {
        procedureErrors.push({
          idReal1,
          step: "procedure",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      ok: procedureErrors.length === 0,
      transferred,
      procedureErrors,
      procedure: proc,
      note:
        "Customer limit and additional business rules should be implemented in the same stored procedure (or chained procedures) on SQL Server.",
    });
  } catch (error) {
    console.error("Online transfer API error:", error);
    return NextResponse.json(
      {
        error: "Transfer failed",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
