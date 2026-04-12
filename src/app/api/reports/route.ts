import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import {
  REPORT_QUERY_KEYS,
  buildReportQueries,
  type ReportQueryKey,
} from "@/lib/queries";
import { buildWhereClause, injectWhere } from "@/lib/filters";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

    const { searchParams } = new URL(req.url);
    const reportName = searchParams.get("name") as ReportQueryKey | null;

    if (!reportName || !REPORT_QUERY_KEYS.includes(reportName)) {
      return NextResponse.json(
        { error: `Invalid report. Valid reports: ${REPORT_QUERY_KEYS.join(", ")}` },
        { status: 400 }
      );
    }

    const where = buildWhereClause(searchParams);
    const rq = buildReportQueries();
    const query = injectWhere(rq[reportName], where);
    const data = await executeReadOnlyQuery(query);

    return NextResponse.json({ data, report: reportName });
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json(
      { error: "Failed to load report", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
